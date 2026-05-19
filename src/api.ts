import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { GranolaAuth } from './auth';
import { nodeFetch } from './fetch';

const MCP_SERVER_URL = 'https://mcp.granola.ai/mcp';
const DEFAULT_PAGE_SIZE = 100;
const FETCH_BATCH_SIZE = 10;
const DEFAULT_TIME_RANGE: SyncTimeRange = 'last_30_days';

const LIST_MEETINGS_TOOL = 'list_meetings';
const GET_MEETINGS_TOOL = 'get_meetings';

export type SyncTimeRange = 'this_week' | 'last_week' | 'last_30_days';

export interface GranolaDocument {
	id: string;
	title: string;
	notes: ProseMirrorDoc;
	notes_plain: string;
	notes_markdown: string;
	last_viewed_panel?: {
		content?: ProseMirrorDoc | string;
		[key: string]: unknown;
	};
	created_at: string;
	updated_at: string;
	user_id: string;
	people?:
		| string[]
		| {
				attendees?: Array<{
					email?: string;
					details?: {
						person?: {
							name?: {
								fullName?: string;
							};
						};
						company?: {
							name?: string;
						};
					};
				}>;
				creator?: {
					name?: string;
					email?: string;
				};
				title?: string;
		  };
	[key: string]: unknown;
}

export interface ProseMirrorDoc {
	type: 'doc';
	content?: ProseMirrorNode[];
}

export interface ProseMirrorNode {
	type: string;
	attrs?: Record<string, unknown>;
	content?: ProseMirrorNode[];
	text?: string;
	marks?: Array<{
		type: string;
		attrs?: Record<string, unknown>;
	}>;
}

export interface GetDocumentsRequest {
	limit?: number;
	offset?: number;
	timeRange?: SyncTimeRange;
}

export interface GetDocumentsResponse {
	docs: GranolaDocument[];
	deleted: string[];
}

interface McpTool {
	name: string;
	description?: string;
	inputSchema?: Record<string, unknown>;
}

interface ParsedParticipant {
	name: string;
	email: string;
	organization: string;
	isCreator: boolean;
}

interface ParsedMeeting {
	id: string;
	title: string;
	date: string;
	participants: ParsedParticipant[];
	privateNotes: string;
	summary: string;
}

type ToolResult = Awaited<ReturnType<Client['callTool']>>;

export class GranolaAPI {
	private client: Client | null = null;
	private transport: StreamableHTTPClientTransport | null = null;
	private tools: McpTool[] = [];
	private auth: GranolaAuth;

	constructor(auth: GranolaAuth) {
		this.auth = auth;
	}

	get isConnected(): boolean {
		return this.client !== null;
	}

	async loadCredentials(): Promise<void> {
		await this.connect();
	}

	async connect(): Promise<void> {
		await this.disconnect();

		this.client = new Client({
			name: 'obsidian-granola-importer',
			version: '2.0.0',
		});
		this.transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
			authProvider: this.auth,
			fetch: nodeFetch,
		});

		try {
			await this.client.connect(this.transport);
			await this.discoverTools(true);
		} catch (error) {
			this.client = null;
			this.transport = null;
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		if (this.client) {
			try {
				await this.client.close();
			} catch {
				// Ignore shutdown errors from an already-closed MCP session.
			}
		}

		this.client = null;
		this.transport = null;
		this.tools = [];
	}

	async finishAuth(authorizationCode: string): Promise<void> {
		const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
			authProvider: this.auth,
			fetch: nodeFetch,
		});
		await transport.finishAuth(authorizationCode);
		await this.connect();
	}

	async getDocuments(options: GetDocumentsRequest = {}): Promise<GetDocumentsResponse> {
		const { limit = DEFAULT_PAGE_SIZE, offset = 0, timeRange = DEFAULT_TIME_RANGE } = options;
		const allMeetings = await this.listMeetings(timeRange);
		const selectedMeetings = allMeetings.slice(offset, offset + limit);

		if (selectedMeetings.length === 0) {
			return { docs: [], deleted: [] };
		}

		const docs = await this.fetchMeetingDetails(selectedMeetings);
		return { docs, deleted: [] };
	}

	async getAllDocuments(): Promise<GranolaDocument[]> {
		const allMeetings = await this.listMeetings(DEFAULT_TIME_RANGE);
		if (allMeetings.length === 0) {
			return [];
		}

		return this.fetchMeetingDetails(allMeetings);
	}

	async getAvailableTools(): Promise<McpTool[]> {
		await this.ensureConnected();
		return this.discoverTools();
	}

	private async listMeetings(timeRange: SyncTimeRange): Promise<ParsedMeeting[]> {
		const toolName = await this.requireTool(LIST_MEETINGS_TOOL);
		const text = await this.callToolText(toolName, { time_range: timeRange });
		return parseMeetingsResponse(text);
	}

	private async fetchMeetingDetails(meetings: ParsedMeeting[]): Promise<GranolaDocument[]> {
		const toolName = await this.requireTool(GET_MEETINGS_TOOL);
		const docs: GranolaDocument[] = [];

		for (let index = 0; index < meetings.length; index += FETCH_BATCH_SIZE) {
			const batch = meetings.slice(index, index + FETCH_BATCH_SIZE);
			const text = await this.callToolText(toolName, {
				meeting_ids: batch.map(meeting => meeting.id),
			});
			const details = parseMeetingsResponse(text);
			const detailsById = new Map(details.map(meeting => [meeting.id, meeting]));

			for (const meeting of batch) {
				docs.push(toGranolaDocument(detailsById.get(meeting.id) ?? meeting));
			}
		}

		return docs;
	}

	private async callToolText(name: string, args: Record<string, unknown>): Promise<string> {
		await this.ensureConnected();
		const result = (await this.getClient().callTool({ name, arguments: args })) as ToolResult;
		const text = extractToolText(result);

		if ('isError' in result && result.isError) {
			throw new Error(text || `Granola MCP tool failed: ${name}`);
		}

		return text;
	}

	private async requireTool(name: string): Promise<string> {
		const tools = await this.discoverTools();
		if (!tools.some(tool => tool.name === name)) {
			const availableTools = tools.map(tool => tool.name).join(', ') || 'none';
			throw new Error(
				`Granola MCP tool "${name}" is unavailable. Available tools: ${availableTools}`
			);
		}
		return name;
	}

	private async discoverTools(force = false): Promise<McpTool[]> {
		await this.ensureConnected();

		if (!force && this.tools.length > 0) {
			return this.tools;
		}

		const result = await this.getClient().listTools();
		this.tools = result.tools.map(tool => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
		}));
		return this.tools;
	}

	private async ensureConnected(): Promise<void> {
		if (!this.client) {
			await this.connect();
		}
	}

	private getClient(): Client {
		if (!this.client) {
			throw new Error('Not connected to Granola');
		}
		return this.client;
	}
}

function extractToolText(result: ToolResult): string {
	if ('content' in result && Array.isArray(result.content)) {
		return result.content
			.filter(item => item.type === 'text' && typeof item.text === 'string')
			.map(item => item.text)
			.join('\n');
	}

	if ('structuredContent' in result && result.structuredContent) {
		return JSON.stringify(result.structuredContent);
	}

	if ('toolResult' in result) {
		return typeof result.toolResult === 'string'
			? result.toolResult
			: JSON.stringify(result.toolResult);
	}

	return '';
}

function parseMeetingsResponse(text: string): ParsedMeeting[] {
	const meetings: ParsedMeeting[] = [];
	const meetingRegex =
		/<meeting\s+id="([^"]+)"\s+title="([^"]*?)"\s+date="([^"]*?)">([\s\S]*?)<\/meeting>/g;

	let match: RegExpExecArray | null;
	while ((match = meetingRegex.exec(text)) !== null) {
		const [, id, title, date, body] = match;
		const participantsMatch = body.match(
			/<known_participants>\s*([\s\S]*?)\s*<\/known_participants>/
		);
		const notesMatch = body.match(/<private_notes>\s*([\s\S]*?)\s*<\/private_notes>/);
		const summaryMatch = body.match(/<summary>\s*([\s\S]*?)\s*<\/summary>/);

		meetings.push({
			id: decodeXml(id),
			title: decodeXml(title),
			date: decodeXml(date),
			participants: participantsMatch
				? parseParticipants(decodeXml(participantsMatch[1]))
				: [],
			privateNotes: notesMatch ? decodeXml(notesMatch[1].trim()) : '',
			summary: summaryMatch ? decodeXml(summaryMatch[1].trim()) : '',
		});
	}

	return meetings;
}

function parseParticipants(text: string): ParsedParticipant[] {
	if (!text.trim()) {
		return [];
	}

	return text
		.split(/,\s*(?=[A-Z])/)
		.map(part => {
			const emailMatch = part.match(/<([^>]+)>/);
			const email = emailMatch?.[1] ?? '';
			const isCreator = part.includes('(note creator)');
			let name = part
				.replace(/<[^>]+>/, '')
				.replace(/\(note creator\)/g, '')
				.trim();
			let organization = '';
			const fromMatch = name.match(/^(.+?)\s+from\s+(.+)$/);

			if (fromMatch) {
				name = fromMatch[1].trim();
				organization = fromMatch[2].trim();
			}

			return {
				name,
				email,
				organization,
				isCreator,
			};
		})
		.filter(participant => participant.name || participant.email);
}

function toGranolaDocument(meeting: ParsedMeeting): GranolaDocument {
	const timestamp = parseGranolaDate(meeting.date);
	const markdown = buildMarkdown(meeting);

	return {
		id: meeting.id,
		title: meeting.title || 'Untitled Meeting',
		notes: { type: 'doc', content: [] },
		notes_plain: markdownToPlainText(markdown),
		notes_markdown: markdown,
		created_at: timestamp,
		updated_at: timestamp,
		user_id: '',
		people: toPeople(meeting),
	};
}

function buildMarkdown(meeting: ParsedMeeting): string {
	const parts: string[] = [];

	if (meeting.privateNotes.trim()) {
		parts.push(`## Notes\n\n${meeting.privateNotes.trim()}`);
	}

	if (meeting.summary.trim()) {
		parts.push(`## Summary\n\n${meeting.summary.trim()}`);
	}

	return parts.join('\n\n').trim();
}

function toPeople(meeting: ParsedMeeting): NonNullable<GranolaDocument['people']> {
	const creator = meeting.participants.find(participant => participant.isCreator);
	const attendees = meeting.participants
		.filter(participant => !participant.isCreator)
		.map(participant => ({
			email: participant.email || undefined,
			details: {
				person: {
					name: {
						fullName: participant.name,
					},
				},
				company: participant.organization
					? {
							name: participant.organization,
						}
					: undefined,
			},
		}));

	return {
		attendees,
		creator: creator
			? {
					name: creator.name,
					email: creator.email || undefined,
				}
			: undefined,
		title: meeting.title,
	};
}

function parseGranolaDate(date: string): string {
	const parsed = new Date(date);
	if (!Number.isNaN(parsed.getTime())) {
		return parsed.toISOString();
	}

	return new Date().toISOString();
}

function markdownToPlainText(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/!\[[^\]]*]\([^)]+\)/g, '')
		.replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/[*_~>#-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function decodeXml(value: string): string {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

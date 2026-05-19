import { GranolaAPI } from '../../src/api';
import { GranolaAuth } from '../../src/auth';

const mockConnect = jest.fn();
const mockClose = jest.fn();
const mockListTools = jest.fn();
const mockCallTool = jest.fn();
const mockFinishAuth = jest.fn();

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
	Client: jest.fn().mockImplementation(() => ({
		connect: mockConnect,
		close: mockClose,
		listTools: mockListTools,
		callTool: mockCallTool,
	})),
}));

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
	StreamableHTTPClientTransport: jest.fn().mockImplementation(() => ({
		finishAuth: mockFinishAuth,
	})),
}));

const listResponse = `
<meeting id="meeting-1" title="Alpha &amp; Beta" date="Mar 3, 2026 3:00 PM">
	<known_participants>Alex Smith (note creator) from OpenAI &lt;alex@example.com&gt;, Sam Lee from Acme &lt;sam@acme.com&gt;</known_participants>
</meeting>
<meeting id="meeting-2" title="Planning" date="Mar 4, 2026 10:15 AM">
	<known_participants>Riley Jones from Example &lt;riley@example.com&gt;</known_participants>
</meeting>`;

const detailsResponse = `
<meeting id="meeting-1" title="Alpha &amp; Beta" date="Mar 3, 2026 3:00 PM">
	<known_participants>Alex Smith (note creator) from OpenAI &lt;alex@example.com&gt;, Sam Lee from Acme &lt;sam@acme.com&gt;</known_participants>
	<private_notes>Private **notes**</private_notes>
	<summary>- Summary item</summary>
</meeting>
<meeting id="meeting-2" title="Planning" date="Mar 4, 2026 10:15 AM">
	<known_participants>Riley Jones from Example &lt;riley@example.com&gt;</known_participants>
	<summary>Planning summary</summary>
</meeting>`;

function toolText(text: string, isError = false) {
	return {
		content: [{ type: 'text', text }],
		isError,
	};
}

describe('GranolaAPI', () => {
	let auth: GranolaAuth;
	let api: GranolaAPI;

	beforeEach(async () => {
		jest.clearAllMocks();

		auth = new GranolaAuth();
		await auth.saveTokens({
			access_token: 'access-token',
			refresh_token: 'refresh-token',
			token_type: 'Bearer',
		});
		api = new GranolaAPI(auth);

		mockConnect.mockResolvedValue(undefined);
		mockClose.mockResolvedValue(undefined);
		mockFinishAuth.mockResolvedValue(undefined);
		mockListTools.mockResolvedValue({
			tools: [
				{ name: 'list_meetings', inputSchema: { type: 'object' } },
				{ name: 'get_meetings', inputSchema: { type: 'object' } },
			],
		});
		mockCallTool.mockImplementation(({ name }) => {
			if (name === 'list_meetings') {
				return Promise.resolve(toolText(listResponse));
			}
			if (name === 'get_meetings') {
				return Promise.resolve(toolText(detailsResponse));
			}
			return Promise.resolve(toolText('', true));
		});
	});

	it('connects to the Granola MCP server and discovers tools', async () => {
		await api.loadCredentials();

		expect(mockConnect).toHaveBeenCalledTimes(1);
		expect(mockListTools).toHaveBeenCalledTimes(1);
		expect(api.isConnected).toBe(true);
		await expect(api.getAvailableTools()).resolves.toEqual([
			{ name: 'list_meetings', description: undefined, inputSchema: { type: 'object' } },
			{ name: 'get_meetings', description: undefined, inputSchema: { type: 'object' } },
		]);
	});

	it('lists and fetches meetings through MCP tools', async () => {
		const response = await api.getDocuments({ limit: 1, offset: 0 });

		expect(mockCallTool).toHaveBeenNthCalledWith(1, {
			name: 'list_meetings',
			arguments: { time_range: 'last_30_days' },
		});
		expect(mockCallTool).toHaveBeenNthCalledWith(2, {
			name: 'get_meetings',
			arguments: { meeting_ids: ['meeting-1'] },
		});
		expect(response.deleted).toEqual([]);
		expect(response.docs).toHaveLength(1);
		expect(response.docs[0]).toMatchObject({
			id: 'meeting-1',
			title: 'Alpha & Beta',
			notes_markdown: '## Notes\n\nPrivate **notes**\n\n## Summary\n\n- Summary item',
			notes_plain: 'Notes Private notes Summary Summary item',
			user_id: '',
		});
		expect(response.docs[0].people).toMatchObject({
			creator: { name: 'Alex Smith', email: 'alex@example.com' },
			attendees: [
				{
					email: 'sam@acme.com',
					details: {
						person: { name: { fullName: 'Sam Lee' } },
						company: { name: 'Acme' },
					},
				},
			],
		});
	});

	it('fetches all listed meetings without the default page size cap', async () => {
		const docs = await api.getAllDocuments();

		expect(docs).toHaveLength(2);
		expect(docs.map(doc => doc.id)).toEqual(['meeting-1', 'meeting-2']);
	});

	it('supports custom pagination offsets for connection tests', async () => {
		const response = await api.getDocuments({ limit: 1, offset: 1 });

		expect(response.docs).toHaveLength(1);
		expect(mockCallTool).toHaveBeenLastCalledWith({
			name: 'get_meetings',
			arguments: { meeting_ids: ['meeting-2'] },
		});
	});

	it('throws when Granola does not advertise required tools', async () => {
		mockListTools.mockResolvedValue({ tools: [{ name: 'query_granola_meetings' }] });

		await expect(api.getAllDocuments()).rejects.toThrow(
			'Granola MCP tool "list_meetings" is unavailable'
		);
	});

	it('surfaces MCP tool errors', async () => {
		mockCallTool.mockImplementation(({ name }) => {
			if (name === 'list_meetings') {
				return Promise.resolve(toolText('rate limited', true));
			}
			return Promise.resolve(toolText(detailsResponse));
		});

		await expect(api.getAllDocuments()).rejects.toThrow('rate limited');
	});

	it('finishes OAuth and reconnects', async () => {
		await api.finishAuth('authorization-code');

		expect(mockFinishAuth).toHaveBeenCalledWith('authorization-code');
		expect(mockConnect).toHaveBeenCalledTimes(1);
	});

	it('disconnects the MCP client', async () => {
		await api.loadCredentials();
		await api.disconnect();

		expect(mockClose).toHaveBeenCalledTimes(1);
		expect(api.isConnected).toBe(false);
	});
});

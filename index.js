const uuid = require('uuid/v4');
const express = require('express');
const app = express().use(express.json());
const server = require('http').Server(app);
const io = require('socket.io')(server);

const PORT = process.env.PORT || 8081;

const sockets = {};
const clids = {};
const responses = {};

app.post('/:clid', (req, res) => {
	const { clid } = req.params;
	const socket = sockets[clids[clid]];

	if (!socket) {
		return res.status(500).json({ error: 'client not connected' });
	}

	const packet = {
		id: uuid(),
		headers: req.headers,
		body: req.body,		
	};

	const entry = {
		id: packet.id,
		created_at: (new Date).toUTCString(),
		request: { headers: req.headers, body: req.body },
	};

	responses[packet.id] = { res, entry };

	socket.emit('request', packet);
});


const socketConnected = (socket) => {
	console.log(`Client ${socket.id} connected`);
	sockets[socket.id] = socket;
};

const socketHandshake = (socket, clid) => {
	clids[clid] = socket.id
	console.log(`Client ${socket.id} registered as ${clid}`);
};

const socketResponded = (_, {id, status, headers, body}) => {
	if(!responses[id]) {
		return;
	}

	responses[id].res
		.status(status)
		.set(headers)
		.json(body);

	responses[id].entry.response = { status, headers, body };
	responses[id].entry.updated_at = (new Date).toUTCString();

	delete responses[id];
}

const socketDisconnected = (socket) => {
	console.log(`Client ${socket.id} disconnected, cleaning up`);
	Object.keys(clids).forEach(clid => {
		if (clids[clid] === socket.id) {
			delete clids[clid];
		}
	});
	delete sockets[socket.id];
};



io.on('connection', socket => {
	socketConnected(socket);
	socket.on('handshake', clid => socketHandshake(socket, clid));
	socket.on('response', response => socketResponded(socket, response));
	socket.on('disconnect', () => socketDisconnected(socket));
})

server.listen(PORT, console.log(`Listening on :${PORT}`))
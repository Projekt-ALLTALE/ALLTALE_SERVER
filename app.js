const express = require('express');
const session = require('express-session')
const LevelStore = require('level-session-store')(session)
const app = express();

const http = require('http');
const httpServer = http.createServer(app);

const io = require('socket.io')(httpServer, {
    path: '/alltale-core',
    cors: {
        origin: '*'
    }
});

const sessionMiddleware = session({
    name: 'ALLTALE_SESSION',
    secret: 'ALLTALE',
    resave: true,
    saveUninitialized: true,
    cookie: {maxAge: 60000},
    store: new LevelStore('./data/sessions'),
    genid: function (req) {
        return uuid.v4()
    }
})

const uuid = require('uuid');
const randomWords = require('random-words')

function rdm(min = 0, max = 1, fix = 2) {
    let ratio = max - min;
    let range = Math.random() * ratio;
    return parseFloat((range + min).toFixed(fix));
}

io.engine.generateId = (req) => {
    return uuid.v4();
}

app.use(sessionMiddleware);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/pages/index.html');
});

io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
    const session = socket.request.session;

    socket.emit('message:global', `${session.lastMessage}`);

    if (!socket.data.identity) socket.data.identity = {}
    socket.data.identity.id = `${randomWords({
        exactly: 1,
        maxLength: 8,
        formatter: word => word.toUpperCase()
    })}#${rdm(1000, 9999, 0)}`;
    socket.emit('user:update-info', socket.data.identity);
    console.log(`Client connected [${socket.id}]:[${socket.data.identity.id}]`);
    socket.on('message:global', async (msg) => {
        session.lastMessage = msg;
        session.save();
        io.emit('message:global', `[${socket.data.identity.id}]: ${msg}`);
        console.log(`Message from [${socket.id}]: ${msg}`);
        console.log(session.lastMessage)
    });
    socket.on('disconnect', () => {
        console.log(`Client disconnected [${socket.id}]`);
    });
});


httpServer.listen(21611, () => {
    console.log('ALLTALE is listening on *:21611');
});
const express = require('express');
const session = require('express-session')
const LevelStore = require('level-session-store')(session)
const app = express();

const http = require('http');
const httpServer = http.createServer(app);

const Mongo = require('mongodb').MongoClient;
let recentMessageDb = null;
Mongo.connect(`mongodb://alltale:Only4ALLTALE.dev@alltale.i0x0i.ltd:27017/${(process.env.NODE_ENV === 'production') ? 'alltale' : 'alltale-dev'}`,
    (err, db) => {
        if (err) throw err;
        recentMessageDb = db.db().collection('recentMessage')
    }
);

const uuid = require('uuid');
const randomWords = require('random-words')
const crypto = require("crypto");
const cookie = require("cookie");

require('pkginfo')(module, 'name', 'version')

const {ChatMessage, SystemMessage} = require('./lib/beans/MessageModel')

const CONFIG = {
    CORS_WHITELIST: [
        'http://127.0.0.1:21627',
        'http://127.0.0.1:3000'
    ],
    sessionMiddlewareCookieName: 'ALLTALE_SESSION',
    sessionMiddlewareCookieSecret: 'ALLTALE',
    sessionMiddlewareCookieOptions: {
        // maxAge: 60000,
        httpOnly: false,
        domain: process.env.ALLTALE_HOST || '127.0.0.1',
    },
    SERVER_INFO: {
        name: process.env.ALLTALE_SERVER_NAME || exports["name"] || 'unstable-official-server',
        region: process.env.ALLTALE_REGION || 'unstable',
        version: process.env.ALLTALE_VERSION || exports["version"] || 'unstable',
    }
}

if (process.env.CORS_WHITELIST) {
    CONFIG.CORS_WHITELIST.push(process.env.CORS_WHITELIST)
}
console.log('CORS Whitelist: ' + CONFIG.CORS_WHITELIST.join(', '))

// noinspection JSValidateTypes
const io = require('socket.io')(httpServer, {
    path: '/alltale-core',
    cors: {
        origin: function (origin, callback) {
            if (CONFIG.CORS_WHITELIST.indexOf(origin) !== -1) {
                callback(null, true)
            } else {
                callback(new Error('Not allowed by CORS'))
            }
        },
        credentials: true,
    }
});

const sessionMiddleware = session({
    name: CONFIG.sessionMiddlewareCookieName,
    secret: CONFIG.sessionMiddlewareCookieSecret,
    resave: true,
    saveUninitialized: true,
    cookie: CONFIG.sessionMiddlewareCookieOptions,
    store: new LevelStore('./data/sessions'),
    genid: function (req) {
        return uuid.v4()
    }
})

function rdm(min = 0, max = 1, fix = 2) {
    let ratio = max - min;
    let range = Math.random() * ratio;
    return parseFloat((range + min).toFixed(fix));
}

Array.prototype.remove = function (val) {
    let index = this.indexOf(val);
    if (index > -1) {
        this.splice(index, 1);
    }
};

io.engine.generateId = (req) => {
    return uuid.v4();
}

app.use(sessionMiddleware);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/pages/index.html');
});

io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res, next);
});

class utils {
    constructor(io) {
        this.io = io
    }

    getSocketsByIdentity(id, room = '') {
        let foundSockets = []
        for (const socket of this.io.of(room).sockets) {
            if (socket[1].data.identity) {
                if (socket[1].data.identity.id === id) foundSockets.push(socket[1]);
            }
        }
        return foundSockets.length > 0 ? foundSockets : null;
    }

    getOnlineCountByRoom(room = '') {
        return this.io.of(room).sockets.size || 0;
    }

    getOnlineMembersByRoom(room = '') {
        let onlineMembers = []
        for (const socket of this.io.of(room).sockets) {
            onlineMembers.push({
                id: socket[1].data.identity.id,
                connectionId: socket[0]
            })
        }
        return onlineMembers;
    }

    cookieSign(val, secret) {
        if ('string' != typeof val) throw new TypeError("Cookie value must be provided as a string.");
        if ('string' != typeof secret) throw new TypeError("Secret string must be provided.");
        return val + '.' + crypto
            .createHmac('sha256', secret)
            .update(val)
            .digest('base64')
            .replace(/\=+$/, '');
    };
}

const util = new utils(io)

const typingMember = {
    lobby: []
}

io.on('connection', (socket) => {
    const session = socket.request.session;

    /* Send server info */
    socket.emit('session:server-info', CONFIG.SERVER_INFO);

    /* Send cookie */
    socket.emit('session:update-cookie', cookie.serialize(
        CONFIG.sessionMiddlewareCookieName,
        `s:${util.cookieSign(session.id, CONFIG.sessionMiddlewareCookieSecret)}`,
        CONFIG.sessionMiddlewareCookieOptions)
    );

    /* Assign identity */
    if (!session.identity) {
        session.identity = {}
        session.identity.id = `${randomWords({
            exactly: 1,
            maxLength: 8,
            formatter: word => word.toUpperCase()
        })}#${rdm(1000, 9999, 0)}`;
        session.save();
    }
    socket.data.identity = session.identity;
    socket.emit('user:update-info', socket.data.identity);

    /* Terminate other sockets has same identity */
    util.getSocketsByIdentity(socket.data.identity.id).forEach(existsSocket => {
        if (existsSocket.id !== socket.id) existsSocket.emit('session:conflict')
    });

    /* Online broadcast */
    io.emit('broadcast:online', JSON.stringify({
        online: util.getOnlineCountByRoom(),
        members: util.getOnlineMembersByRoom()
    }));
    console.log('🔈 Broadcast online: ', util.getOnlineCountByRoom());

    /* Welcome */
    socket.emit('message:lobby', SystemMessage.Info(`${socket.data.identity.id}，欢迎！`));

    /* Recent messages */
    recentMessageDb?.find({}).sort({time: -1}).limit(100).toArray(async (err, res) => {
        if (err) throw err;
        res.reverse().forEach(message => socket.emit('message:lobby', JSON.stringify(message)));
        if (res.length > 0) socket.emit('message:lobby', SystemMessage.Info('', '以上是历史消息'));
    });

    /* Messaging logic */
    console.log(`🔌 Client connected [${socket.id}]:[${socket.data.identity.id}]`);
    socket.on('message:send', async (msg) => {
        if (!msg || msg.trim() === '') return socket.emit('message:lobby', SystemMessage.Warn('请不要发送空白消息'));
        // TODO: Authentication
        // if (msg.startsWith('login')) {
        //     let arr = msg.split('@')
        //     if (arr.length === 3) {
        //         if (arr[1] === (process.env.ALLTALE_ADMIN || 'ADMIN') &&
        //             arr[2] === (process.env.ALLTALE_ADMIN_PWD || 'ADMIN')) {
        //             session.identity.id = `${arr[1]}#管理员`;
        //             session.identity.isAdmin = true;
        //             session.save();
        //             socket.data.identity = session.identity;
        //             socket.emit('user:update-info', socket.data.identity);
        //             return socket.emit('message:lobby', JSON.stringify({
        //                 sender: 'ALLTALE',
        //                 time: new Date().getTime(),
        //                 message: `管理员${socket.data.identity.id.split('#')[0]}，欢迎回来`,
        //                 info: true,
        //                 admin: true
        //             }));
        //         } else return socket.emit('message:lobby', JSON.stringify({
        //             sender: 'ALLTALE',
        //             time: new Date().getTime(),
        //             message: `登录凭据有误`,
        //             warn: true
        //         }));
        //     }
        // }
        const message = ChatMessage(socket.data.identity.id, msg, socket.data.identity.isAdmin, false);
        io.emit('message:lobby', message.stringify());
        recentMessageDb?.insertOne(message.raw());
        console.log(`✉ Message from [${socket.id}]:[${socket.data.identity.id}]: ${msg}`);
    });

    /* Typing notice */
    socket.on('session:typing-start', () => {
        if (typingMember.lobby.indexOf(socket.data.identity.id) === -1) typingMember.lobby.push(socket.data.identity.id)
        io.emit('session:typing', JSON.stringify({
            room: '/',
            members: typingMember.lobby
        }))
    })
    socket.on('session:typing-finish', () => {
        typingMember.lobby.remove(socket.data.identity.id)
        io.emit('session:typing', JSON.stringify({
            room: '/',
            members: typingMember.lobby
        }))
    })

    socket.on('disconnect', () => {
        io.emit('broadcast:online', JSON.stringify({
            online: util.getOnlineCountByRoom(),
            members: util.getOnlineMembersByRoom()
        }));
        console.log('🔈 Broadcast online: ', util.getOnlineCountByRoom());
        console.log(`❌ Client disconnected [${socket.id}]:[${socket.data.identity.id}]`);
        // Clear typing state
        typingMember.lobby.remove(socket.data.identity.id)
        io.emit('session:typing', JSON.stringify({
            room: '/',
            members: typingMember.lobby
        }))
    });
});

httpServer.listen(process.env.ALLTALE_PORT || 21611, () => {
    console.log('🚀 ALLTALE is listening on *:21611');
});
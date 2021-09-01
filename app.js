const express = require('express');
const session = require('express-session')
const LevelStore = require('level-session-store')(session)
const app = express();

const http = require('http');
const httpServer = http.createServer(app);

const uuid = require('uuid');
const randomWords = require('random-words')
const crypto = require("crypto");
const cookie = require("cookie");

const CONFIG = {
    CORS_WHITELIST: [
        'http://192.168.59.1:21627',
        'http://192.168.59.1:3000'
    ],
    sessionMiddlewareCookieName: 'ALLTALE_SESSION',
    sessionMiddlewareCookieSecret: 'ALLTALE',
    sessionMiddlewareCookieOptions: {
        // maxAge: 60000,
        httpOnly: false,
        domain: process.env.ALLTALE_HOST || '192.168.59.1',
    }
}
if (process.env.CORS_WHITELIST) {
    CONFIG.CORS_WHITELIST.push(process.env.CORS_WHITELIST)
}
console.log('CORS Whitelist: ' + CONFIG.CORS_WHITELIST.join(', '))
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

io.engine.generateId = (req) => {
    return uuid.v4();
}

app.use(sessionMiddleware);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/pages/index.html');
});

io.use((socket, next) => {
    // sessionMiddleware(socket.request, {}, next);
    sessionMiddleware(socket.request, socket.request.res, next);
});

class utils {
    constructor(io) {
        this.io = io
    }

    getSocketsByIdentity(id, room = '') {
        let foundSockets = []
        for (const socket of this.io.of(room).sockets) {
            // console.log(socket[0])
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

io.on('connection', (socket) => {
    const session = socket.request.session;

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
    socket.emit('message:lobby', JSON.stringify({
        sender: 'ALLTALE',
        time: new Date().getTime(),
        message: `${socket.data.identity.id}，欢迎！`,
        info: true,
        admin: socket.data.identity.isAdmin
    }));

    /* Messaging logic */
    console.log(`🔌 Client connected [${socket.id}]:[${socket.data.identity.id}]`);
    socket.on('message:send', async (msg) => {
        if (!msg || msg.trim() === '') return socket.emit('message:lobby', JSON.stringify({
            sender: 'ALLTALE',
            time: new Date().getTime(),
            message: '请不要发送空白消息',
            warn: true
        }));
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
        io.emit('message:lobby', JSON.stringify({
            sender: socket.data.identity.id,
            time: new Date().getTime(),
            message: msg,
            admin: socket.data.identity.isAdmin
        }));
        console.log(`✉ Message from [${socket.id}]:[${socket.data.identity.id}]: ${msg}`);
    });
    socket.on('disconnect', () => {
        io.emit('broadcast:online', JSON.stringify({
            online: util.getOnlineCountByRoom(),
            members: util.getOnlineMembersByRoom()
        }));
        console.log('🔈 Broadcast online: ', util.getOnlineCountByRoom());
        console.log(`❌ Client disconnected [${socket.id}]:[${socket.data.identity.id}]`);
    });
});

httpServer.listen(process.env.ALLTALE_PORT || 21611, () => {
    console.log('🚀 ALLTALE is listening on *:21611');
});
class BaseMessage {
    constructor(sender = '', content = '') {
        this._message = {
            sender: sender,
            time: new Date().getTime(),
            message: content,
        }
        return this;
    }

    setSender(sender) {
        this._message.sender = sender;
        return this;
    }

    setMessage(message) {
        this._message.message = message;
        return this;
    }

    isInfo() {
        this._message.info = true;
        return this;
    }

    isWarn() {
        this._message.warn = true;
        return this;
    }

    isAdmin() {
        this._message.admin = true;
        return this;
    }

    stringify() {
        return JSON.stringify(this._message);
    }
}

const ChatMessage = (sender, message, isAdmin = false, stringify = true) => {
    const _msg = new BaseMessage(sender, message);
    if (isAdmin) _msg.isAdmin();
    return stringify ? _msg.stringify() : _msg;
}

const SystemMessage = {
    Info(message, sender = 'ALLTALE') {
        return new BaseMessage(sender, message).isInfo().stringify();
    },
    Warn(message, sender = 'ALLTALE') {
        return new BaseMessage(sender, message).isWarn().stringify();
    }
};

module.exports = {BaseMessage, ChatMessage, SystemMessage}
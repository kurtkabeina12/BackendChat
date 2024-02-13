const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    recepientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    message:String,
    timeStamp:{
        type: Date,
        default: Date.now
    },
    isRead:{
        type: Boolean,
        default: false
    }
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
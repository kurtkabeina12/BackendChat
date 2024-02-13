const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const http = require('http');
const socketIo = require('socket.io');
const jwt = require("jsonwebtoken");

const app = express();
const port = 8000;
const cors = require("cors");

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(passport.initialize());

mongoose
    .connect("mongodb+srv://admin:ХЪ@cluster0.p81nhm2.mongodb.net/", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("Connected to Mongo Db");
    })
    .catch((err) => {
        console.log("Error connecting to MongoDb", err);
    });

const server = http.createServer(app);
const io = socketIo(server);

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('chat message', async ({ userId, recepientId, msg, senderId, timeStamp }) => {
        // Save the message to the database
        const message = new Message({
            senderId: senderId,
            senderId: userId,
            message: msg,
            recepientId: recepientId,
            timeStamp: timeStamp,
            isRead: false,
        });
        await message.save();

        io.emit('chat message', { userId, msg, recepientId, senderId, timeStamp });
        console.log(msg)
    });
});

app.listen(port, () => {
    console.log("Server running on port 8000");
});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});


const User = require("./models/user");
const Message = require("./models/message");

//endpoint for registration of the user

app.post("/register", (req, res) => {
    const { name, email, password, image } = req.body;

    // create a new User object
    const newUser = new User({ name, email, password, image });

    // save the user to the database
    newUser
        .save()
        .then(() => {
            res.status(200).json({ message: "User registered successfully" });
        })
        .catch((err) => {
            console.log("Error registering user", err);
            res.status(500).json({ message: "Error registering the user!" });
        });
});
//create token for user
const createToken = (userId) => {
    const payload = {
        userId: userId,
    };

    const token = jwt.sign(payload, "Q$r2K6W8n!jCW%Zk", { expiresIn: "1h" });

    return token;
};



app.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(404).json({ message: "Email and the password are required" })
    }

    User.findOne({ email }).then((user) => {
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        if (user.password !== password) {
            return res.status(404).json({ message: "Invalid password" })
        }

        const token = createToken(user._id);
        res.status(200).json({ token })
    }).catch((error) => {
        console.log("error in finding")
        res.status(500).json({ message: "Invalid server Error!" }, error)
    });
});


//access the users who is logged
app.get("/users/:userId", (req, res) => {
    const loggedInUserId = req.params.userId;

    User.find({ _id: { $ne: loggedInUserId } }).then((users) => {
        res.status(200).json(users)
    }).catch((err) => {
        console.log("Error retrieving users", err)
        res.status(500).json({ message: "Error retrieving users" })
    })
});

app.post("/friend-request", async (req, res) => {
    const { currentUserId, selectedUserId } = req.body;

    try {
        //update user friendsRequestArray
        await User.findByIdAndUpdate(selectedUserId, {
            $push: { friendRequests: currentUserId },
        });

        //update send user friends 
        await User.findByIdAndUpdate(currentUserId, {
            $push: { setFriendRequests: selectedUserId },
        })
        res.sendStatus(200);
    } catch (err) {
        res.sendStatus(500);
    }
});

//show all friend-request for user
app.get("/friend-request/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).populate("friendRequests", "name email image").lean();

        const friendRequests = user.friendRequests;

        res.json(friendRequests);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" })
    }
});

//accept friend-request
app.post("/friend-request/accept", async (req, res) => {
    try {
        const { senderId, recepientId } = req.body;

        const sender = await User.findById(senderId);
        const recepient = await User.findById(recepientId);

        sender.friends.push(recepientId);
        recepient.friends.push(senderId);

        recepient.friendRequests = recepient.friendRequests.filter((request) => request.toString() !== senderId.toString());

        sender.setFriendRequests.filter((request) => request.toString() !== recepientId.toString);

        await sender.save();
        await recepient.save();

        res.status(200).json({ message: "Friens Request accepted successfully" })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Interval Server Error" })
    }

});

app.get("/accepted-friends/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).populate(
            "friends",
            "name email image"
        )

        const acceptedFriends = user.friends;
        res.json(acceptedFriends)
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Interval Server Error" })
    }
})

app.get("/messages/:userId/:recepientId", async (req, res) => {
    try {
        const { userId, recepientId } = req.params;

        const messages = await Message.find({
            $or: [
                { senderId: userId, recepientId: recepientId },
                { senderId: recepientId, recepientId: userId }
            ]
        }).lean();

        res.json(messages);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Interval Server Error" });
    }
});

app.get("/friend-requests/sent/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).populate("setFriendRequests", "name email image").lean();

        const sentFriendRequests = user.setFriendRequests;

        res.json(sentFriendRequests);
    } catch (error) {
        console.log("error", error);
        res.status(500).json({ error: "Internal Server friend-requests/sent/:userId " });
    }
})

app.get("/friends/:userId", (req, res) => {
    try {
        const { userId } = req.params;

        User.findById(userId).populate("friends").then((user) => {
            if (!user) {
                return res.status(404).json({ message: "User not found" })
            }

            const friendIds = user.friends.map((friend) => friend._id);

            res.status(200).json(friendIds);
        })
    } catch (error) {
        console.log("error", error);
        res.status(500).json({ message: "internal server error" })
    }
});

app.put('/messages/read/:userId/:recepientId', async (req, res) => {
    const { userId, recepientId } = req.params;
    try {
        await Message.updateMany(
            { senderId: recepientId, recepientId: userId, isRead: false },
            { isRead: true }
        );
        res.status(200).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/messages/unread/:userId/:recepientId', async (req, res) => {
    const { userId, recepientId } = req.params;
    try {
      const count = await Message.countDocuments({
        senderId: recepientId,
        recepientId: userId,
        isRead: false
      });
      res.json(count);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  

require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

app.get('/', (req, res) => {
    res.send('Private Chat Server is Running');
});

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;

        next();
    } catch (error) {
        next(new Error('Invalid token'));
    }
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
    const userId = socket.userId;

    socket.join(userId);
    onlineUsers.set(userId, socket.id);

    io.emit('online_users', Array.from(onlineUsers.keys()));

    socket.on('send_message', async (data) => {
        try {
            const { receiverId, message } = data;

            if (!receiverId || !message || !message.trim()) return;

            const receiver = await User.findById(receiverId);

            if (!receiver) return;

            const newMessage = await Message.create({
                sender: userId,
                receiver: receiverId,
                message: message.trim()
            });

            io.to(userId).to(receiverId).emit('receive_message', newMessage);
        } catch (error) {
            console.log(error);
        }
    });

    socket.on('disconnect', () => {
        if (onlineUsers.get(userId) === socket.id) {
            onlineUsers.delete(userId);
        }

        io.emit('online_users', Array.from(onlineUsers.keys()));
    });
});

server.listen(process.env.PORT || 5000, () => {
    console.log(`Server running on port ${process.env.PORT || 5000}`);
});
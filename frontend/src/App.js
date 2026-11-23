import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const API = 'http://localhost:5000';

function App() {
    const [token, setToken] = useState(localStorage.getItem('token') || '');
    const [currentUser, setCurrentUser] = useState(
        JSON.parse(localStorage.getItem('user') || 'null')
    );
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [socket, setSocket] = useState(null);
    const [error, setError] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');

        const endpoint = isRegister ? 'register' : 'login';

        try {
            const response = await fetch(`${API}/api/auth/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(
                    isRegister
                        ? { username, email, password }
                        : { email, password }
                )
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message);
                return;
            }

            if (isRegister) {
                setIsRegister(false);
                setPassword('');
                setError('Registration successful! Please login.');
                return;
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            setToken(data.token);
            setCurrentUser(data.user);
        } catch (error) {
            setError('Cannot connect to server');
        }
    };

    useEffect(() => {
        if (!token) return;

        const newSocket = io(API, {
            auth: { token }
        });

        setSocket(newSocket);

        fetch(`${API}/api/chat/users`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setUsers(data);
            });

        newSocket.on('online_users', (users) => {
            setOnlineUsers(users);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [token]);

    useEffect(() => {
        if (!token || !selectedUser) {
            setMessages([]);
            return;
        }

        setUnreadCounts((prev) => ({
            ...prev,
            [selectedUser._id]: 0
        }));

        fetch(`${API}/api/chat/messages/${selectedUser._id}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setMessages(data);
            });
    }, [token, selectedUser]);

    useEffect(() => {
        if (!socket || !currentUser) return;

        const receiveMessage = (newMessage) => {
            const otherUserId =
                newMessage.sender === currentUser.id
                    ? newMessage.receiver
                    : newMessage.sender;

            const isIncoming = newMessage.sender !== currentUser.id;

            if (selectedUser && otherUserId === selectedUser._id) {
                setMessages((prev) => {
                    if (prev.some((msg) => msg._id === newMessage._id)) {
                        return prev;
                    }
                    return [...prev, newMessage];
                });
            } else if (isIncoming) {
                setUnreadCounts((prev) => ({
                    ...prev,
                    [otherUserId]: (prev[otherUserId] || 0) + 1
                }));
            }
        };

        socket.on('receive_message', receiveMessage);

        return () => {
            socket.off('receive_message', receiveMessage);
        };
    }, [socket, selectedUser, currentUser]);

    const sendMessage = (e) => {
        e.preventDefault();

        if (!message.trim() || !selectedUser || !socket) return;

        socket.emit('send_message', {
            receiverId: selectedUser._id,
            message: message.trim()
        });

        setMessage('');
    };

    const selectChat = (user) => {
        setSelectedUser(user);
        setUnreadCounts((prev) => ({
            ...prev,
            [user._id]: 0
        }));
    };

    const logout = () => {
        if (socket) socket.disconnect();

        localStorage.removeItem('token');
        localStorage.removeItem('user');

        setToken('');
        setCurrentUser(null);
        setSelectedUser(null);
        setMessages([]);
        setUsers([]);
        setSocket(null);
        setUnreadCounts({});
    };

    if (!token) {
        return (
            <div className="auth-container">
                <form className="auth-box" onSubmit={handleAuth}>
                    <h1>💬 ChatSpace</h1>
                    <p>{isRegister ? 'Create your account' : 'Welcome back!'}</p>

                    {isRegister && (
                        <input
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    )}

                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    <button type="submit">
                        {isRegister ? 'Register' : 'Login'}
                    </button>

                    {error && <p className="auth-message">{error}</p>}

                    <p className="switch-auth">
                        {isRegister ? 'Already have an account?' : "Don't have an account?"}
                        <span onClick={() => {
                            setIsRegister(!isRegister);
                            setError('');
                        }}>
                            {isRegister ? ' Login' : ' Register'}
                        </span>
                    </p>
                </form>
            </div>
        );
    }

    return (
        <div className="private-chat">
            <aside className="users-panel">
                <div className="users-header">
                    <h2>ChatSpace 💬</h2>
                    <p>Welcome, {currentUser?.username}</p>
                </div>

                <h3>People</h3>

                {users.map((user) => (
                    <div
                        key={user._id}
                        className={`user-item ${selectedUser?._id === user._id ? 'active' : ''}`}
                        onClick={() => selectChat(user)}
                    >
                        <span>
                            {onlineUsers.includes(user._id) ? '🟢' : '⚪'}
                        </span>
                        <span className="user-name">{user.username}</span>
                        {unreadCounts[user._id] > 0 && (
                            <span className="unread-badge">
                                {unreadCounts[user._id]}
                            </span>
                        )}
                    </div>
                ))}

                <button className="logout-button" onClick={logout}>
                    Logout
                </button>
            </aside>

            <main className="private-chat-main">
                {selectedUser ? (
                    <>
                        <div className="private-header">
                            <h2>{selectedUser.username}</h2>
                            <p>
                                {onlineUsers.includes(selectedUser._id)
                                    ? 'Online'
                                    : 'Offline'}
                            </p>
                        </div>

                        <div className="private-messages">
                            {messages.map((msg) => (
                                <div
                                    key={msg._id}
                                    className={
                                        msg.sender === currentUser.id
                                            ? 'my-message'
                                            : 'other-message'
                                    }
                                >
                                    <p>{msg.message}</p>
                                    <small>
                                        {new Date(msg.createdAt).toLocaleTimeString()}
                                    </small>
                                </div>
                            ))}
                        </div>

                        <form className="private-message-form" onSubmit={sendMessage}>
                            <input
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Type a private message..."
                            />
                            <button type="submit">Send</button>
                        </form>
                    </>
                ) : (
                    <div className="empty-chat">
                        <h2>Welcome to ChatSpace! 💗</h2>
                        <p>Select a person to start a private conversation.</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
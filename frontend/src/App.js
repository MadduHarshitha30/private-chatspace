import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const API = 'http://localhost:5000';

const avatars = Array.from(
    { length: 15 },
    (_, index) => `/avatars/avatar-${String(index + 1).padStart(2, '0')}.png`
);

const LEGACY_DEFAULT_AVATAR = avatars[0];
const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23E5E7EB"/%3E%3Ccircle cx="50" cy="37" r="17" fill="%239CA3AF"/%3E%3Cpath d="M17 91c3-20 16-31 33-31s30 11 33 31" fill="%239CA3AF"/%3E%3C/svg%3E';

const getAvatar = (avatar) =>
    !avatar || avatar === LEGACY_DEFAULT_AVATAR ? DEFAULT_AVATAR : avatar;

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
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [selectedAvatar, setSelectedAvatar] = useState(
        currentUser?.avatar && currentUser.avatar !== LEGACY_DEFAULT_AVATAR
            ? currentUser.avatar
            : avatars[0]
    );
    const [savingAvatar, setSavingAvatar] = useState(false);

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

            const loggedInUser = {
                ...data.user,
                avatar: data.user.avatar || LEGACY_DEFAULT_AVATAR
            };

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(loggedInUser));

            setToken(data.token);
            setCurrentUser(loggedInUser);
            setSelectedAvatar(
                loggedInUser.avatar === LEGACY_DEFAULT_AVATAR
                    ? avatars[0]
                    : loggedInUser.avatar
            );
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

    const deleteChat = async (user) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete your chat with ${user.username}? This will only delete it from your account.`
        );

        if (!confirmed) return;

        try {
            const response = await fetch(
                `${API}/api/chat/messages/${user._id}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                window.alert(data.message || 'Failed to delete chat');
                return;
            }

            if (selectedUser?._id === user._id) {
                setSelectedUser(null);
                setMessages([]);
            }

            setUnreadCounts((prev) => {
                const updated = { ...prev };
                delete updated[user._id];
                return updated;
            });

            window.alert('Chat deleted successfully!');
        } catch (error) {
            window.alert('Cannot connect to server');
        }
    };

    const openAvatarPicker = () => {
        setSelectedAvatar(
            currentUser?.avatar && currentUser.avatar !== LEGACY_DEFAULT_AVATAR
                ? currentUser.avatar
                : avatars[0]
        );
        setShowAvatarPicker(true);
    };

    const saveAvatar = async () => {
        setSavingAvatar(true);

        try {
            const response = await fetch(`${API}/api/auth/avatar`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ avatar: selectedAvatar })
            });

            const data = await response.json();

            if (!response.ok) {
                window.alert(data.message || 'Failed to update avatar');
                return;
            }

            const updatedUser = {
                ...currentUser,
                ...data.user,
                id: data.user.id || currentUser.id
            };

            setCurrentUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setShowAvatarPicker(false);

            window.alert('Profile avatar updated successfully!');
        } catch (error) {
            window.alert('Cannot connect to server');
        } finally {
            setSavingAvatar(false);
        }
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
        setShowAvatarPicker(false);
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

                    <div className="my-profile">
                        <img
                            src={getAvatar(currentUser?.avatar)}
                            alt="My avatar"
                            className="my-avatar"
                        />

                        <p>Welcome, {currentUser?.username}</p>
                    </div>

                    <button
                        className="customize-profile-button"
                        onClick={openAvatarPicker}
                    >
                        Customize Profile
                    </button>
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

                        <img
                            src={getAvatar(user.avatar)}
                            alt={`${user.username}'s avatar`}
                            className="user-avatar"
                        />

                        <span className="user-name">{user.username}</span>

                        {unreadCounts[user._id] > 0 && (
                            <span className="unread-badge">
                                {unreadCounts[user._id]}
                            </span>
                        )}

                        <button
                            className="delete-chat-button"
                            title="Delete chat"
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteChat(user);
                            }}
                        >
                            🗑️
                        </button>
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
                            <img
                                src={getAvatar(selectedUser.avatar)}
                                alt={`${selectedUser.username}'s avatar`}
                                className="chat-header-avatar"
                            />

                            <div>
                                <h2>{selectedUser.username}</h2>
                                <p>
                                    {onlineUsers.includes(selectedUser._id)
                                        ? 'Online'
                                        : 'Offline'}
                                </p>
                            </div>
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

            {showAvatarPicker && (
                <div
                    className="avatar-modal-overlay"
                    onClick={() => setShowAvatarPicker(false)}
                >
                    <div
                        className="avatar-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="close-avatar-modal"
                            onClick={() => setShowAvatarPicker(false)}
                        >
                            ×
                        </button>

                        <h2>Customize Your Profile</h2>
                        <p>Choose your favorite 3D avatar</p>

                        <div className="avatar-preview">
                            <img src={selectedAvatar} alt="Selected avatar" />
                        </div>

                        <div className="avatar-gallery">
                            {avatars.map((avatar) => (
                                <button
                                    key={avatar}
                                    className={`avatar-option ${selectedAvatar === avatar ? 'selected' : ''}`}
                                    onClick={() => setSelectedAvatar(avatar)}
                                >
                                    <img src={avatar} alt="Avatar option" />
                                </button>
                            ))}
                        </div>

                        <button
                            className="save-avatar-button"
                            onClick={saveAvatar}
                            disabled={savingAvatar}
                        >
                            {savingAvatar ? 'Saving...' : 'Save Avatar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
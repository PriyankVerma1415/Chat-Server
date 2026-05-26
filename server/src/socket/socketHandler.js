const User = require('../models/User');
const jwt = require('jsonwebtoken');

const socketHandler = (io) => {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      socket.user = { ...decoded, _id: decoded.id }; // Attach user payload to socket
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('Connected to socket.io');

    socket.on('setup', async (userData) => {
      socket.join(userData._id);
      socket.emit('connected');
      
      // Update online status
      await User.findByIdAndUpdate(userData._id, { onlineStatus: 'online' });
      socket.broadcast.emit('user_online', userData._id);
    });

    socket.on('join_chat', (room) => {
      socket.join(room);
      console.log('User Joined Room: ' + room);
    });

    socket.on('typing', (room) => socket.in(room).emit('typing'));
    socket.on('stop_typing', (room) => socket.in(room).emit('stop_typing'));

    socket.on('new_message', (newMessageReceived) => {
      const sender = newMessageReceived.senderId;
      const receiver = newMessageReceived.receiverId;

      if (!receiver) return console.log('receiverId not defined');

      socket.in(receiver._id).emit('message_received', newMessageReceived);
    });

    socket.on('delete_message', (data) => {
      const { messageId, receiverId } = data;
      if (!receiverId) return;
      socket.in(receiverId).emit('message_deleted', messageId);
    });

    socket.on('edit_message', (data) => {
      const { message, receiverId } = data;
      if (!receiverId) return;
      socket.in(receiverId).emit('message_edited', message);
    });

    socket.on('clear_chat', (data) => {
      const { conversationId, receiverId } = data;
      if (!receiverId) return;
      socket.in(receiverId).emit('chat_cleared', conversationId);
    });

    socket.on('mark_delivered', async (data) => {
      const { messageId, senderId } = data;
      try {
        const Message = require('../models/Message');
        await Message.findByIdAndUpdate(messageId, { status: 'delivered' });
        socket.in(senderId).emit('message_status_update', { messageId, status: 'delivered' });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('mark_read', async (data) => {
      const { conversationId, senderId } = data;
      try {
        const Message = require('../models/Message');
        await Message.updateMany(
          { conversationId, receiverId: socket.user._id, status: { $ne: 'read' } },
          { status: 'read' }
        );
        socket.in(senderId).emit('messages_read', { conversationId });
      } catch (err) {
        console.error(err);
      }
    });
    
    // --- WEBRTC SIGNALING EVENTS --- //
    socket.on('call_user', (data) => {
      const { userToCall, signalData, from, callerInfo, callType } = data;
      // Send the incoming call event to the targeted user
      socket.in(userToCall).emit('incoming_call', {
        signal: signalData,
        from,
        callerInfo,
        callType
      });
    });

    socket.on('answer_call', (data) => {
      // Send the accepted signal back to the caller
      socket.in(data.to).emit('call_accepted', data.signal);
    });

    socket.on('reject_call', (data) => {
      // Notify the caller that the call was rejected
      socket.in(data.to).emit('call_rejected');
    });

    socket.on('ice_candidate', (data) => {
      // Pass the ICE candidate to the peer
      socket.in(data.to).emit('ice_candidate', data.candidate);
    });

    socket.on('end_call', (data) => {
      // Notify the peer that the call ended
      socket.in(data.to).emit('call_ended');
    });

    socket.on('call_busy', (data) => {
      // Notify the caller that the user is busy in another call
      socket.in(data.to).emit('call_busy');
    });
    // ------------------------------- //

    socket.on('disconnect_user', async (userId) => {
      if (userId) {
        await User.findByIdAndUpdate(userId, { onlineStatus: 'offline', lastSeen: Date.now() });
        socket.broadcast.emit('user_offline', userId);
      }
    });

    socket.on('disconnect', async () => {
      console.log('USER DISCONNECTED');
      if (socket.user && socket.user._id) {
        await User.findByIdAndUpdate(socket.user._id, { onlineStatus: 'offline', lastSeen: Date.now() });
        socket.broadcast.emit('user_offline', socket.user._id);
      }
    });
  });
};

module.exports = socketHandler;

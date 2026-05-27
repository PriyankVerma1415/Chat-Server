const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Track active group calls: groupId -> Map<userId, userPayload>
const activeGroupCalls = new Map();

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
      
      // Join all groups the user is a part of
      try {
        const Group = require('../models/Group');
        const groups = await Group.find({ 'members.user': userData._id }, '_id');
        groups.forEach(group => {
          socket.join(group._id.toString());
        });
      } catch (err) {
        console.error('Error joining group rooms:', err);
      }

      socket.emit('connected');

      // Send active group calls to the connecting user
      const activeGroups = Array.from(activeGroupCalls.entries()).map(([groupId, participants]) => ({
        groupId,
        participants: Array.from(participants.values())
      }));
      if (activeGroups.length > 0) {
        socket.emit('active_group_calls', activeGroups);
      }
      
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

    socket.on('group_typing', (data) => {
      const { groupId, username } = data;
      socket.in(groupId).emit('group_typing', { groupId, username });
    });

    socket.on('stop_group_typing', (groupId) => {
      socket.in(groupId).emit('stop_group_typing', groupId);
    });

    socket.on('new_message', (newMessageReceived) => {
      const sender = newMessageReceived.senderId;

      if (newMessageReceived.groupId) {
        // Broadcast to group room except sender
        socket.in(newMessageReceived.groupId).emit('message_received', newMessageReceived);
      } else {
        const receiver = newMessageReceived.receiverId;
        if (!receiver) return console.log('receiverId not defined');
        socket.in(receiver._id).emit('message_received', newMessageReceived);
      }
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
      const { conversationId, senderId, groupId } = data;
      try {
        const Message = require('../models/Message');

        if (groupId) {
          // Update group messages where this user is not in seenBy
          const messagesToUpdate = await Message.find({
            groupId,
            seenBy: { $ne: socket.user._id }
          });
          
          if (messagesToUpdate.length > 0) {
            await Message.updateMany(
              { groupId, seenBy: { $ne: socket.user._id } },
              { $addToSet: { seenBy: socket.user._id } }
            );

            // Fetch user info to send to other clients
            const user = await User.findById(socket.user._id).select('username avatar phoneNumber');

            // Broadcast to group members
            socket.in(groupId).emit('group_messages_read', {
              groupId,
              messageIds: messagesToUpdate.map(m => m._id),
              user
            });
          }
        } else {
          // 1-on-1 chat logic
          await Message.updateMany(
            { conversationId, receiverId: socket.user._id, status: { $ne: 'read' } },
            { status: 'read' }
          );
          if (senderId) {
            socket.in(senderId).emit('messages_read', { conversationId });
          }
        }
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

    // --- GROUP WEBRTC SIGNALING EVENTS --- //
    socket.on('join_group_call', (data) => {
      const { groupId } = data;
      if (!groupId) return;

      let callParticipants = activeGroupCalls.get(groupId);
      if (!callParticipants) {
        callParticipants = new Map();
        activeGroupCalls.set(groupId, callParticipants);
        // Broadcast to the whole group that a call started
        socket.in(groupId).emit('group_call_started', { groupId, initiator: socket.user });
      }

      callParticipants.set(socket.user._id.toString(), socket.user);
      socket.join(`group_call_${groupId}`);

      // Notify others ALREADY IN THE CALL
      socket.in(`group_call_${groupId}`).emit('user_joined_group_call', {
        userId: socket.user._id,
        user: socket.user
      });
      
      // Send the current list of participants to the new joiner
      socket.emit('group_call_participants', {
        groupId,
        participants: Array.from(callParticipants.values())
      });
    });

    socket.on('leave_group_call', (data) => {
      const { groupId } = data;
      if (!groupId) return;

      socket.leave(`group_call_${groupId}`);
      const callParticipants = activeGroupCalls.get(groupId);
      if (callParticipants) {
        callParticipants.delete(socket.user._id.toString());
        socket.in(`group_call_${groupId}`).emit('user_left_group_call', { userId: socket.user._id });
        
        if (callParticipants.size === 0) {
          activeGroupCalls.delete(groupId);
          socket.in(groupId).emit('group_call_ended', { groupId });
        }
      }
    });

    socket.on('group_offer', (data) => {
      const { userToCall, signalData, callerId } = data;
      socket.in(userToCall).emit('group_offer', {
        callerId,
        signal: signalData
      });
    });

    socket.on('group_answer', (data) => {
      const { callerId, signalData, answererId } = data;
      socket.in(callerId).emit('group_answer', {
        answererId,
        signal: signalData
      });
    });

    socket.on('group_ice_candidate', (data) => {
      const { to, candidate, from } = data;
      socket.in(to).emit('group_ice_candidate', {
        candidate,
        from
      });
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
        const userIdStr = socket.user._id.toString();
        
        // Remove user from any active group calls
        activeGroupCalls.forEach((participants, groupId) => {
          if (participants.has(userIdStr)) {
            participants.delete(userIdStr);
            socket.in(`group_call_${groupId}`).emit('user_left_group_call', { userId: socket.user._id });
            
            if (participants.size === 0) {
              activeGroupCalls.delete(groupId);
              socket.in(groupId).emit('group_call_ended', { groupId });
            }
          }
        });

        await User.findByIdAndUpdate(socket.user._id, { onlineStatus: 'offline', lastSeen: Date.now() });
        socket.broadcast.emit('user_offline', socket.user._id);
      }
    });
  });
};

module.exports = socketHandler;

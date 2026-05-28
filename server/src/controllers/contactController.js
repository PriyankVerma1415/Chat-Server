const User = require('../models/User');

const syncContacts = async (req, res) => {
  try {
    const { contacts } = req.body; // Expects array of email strings

    if (!Array.isArray(contacts)) {
      return res.status(400).json({ message: 'Contacts must be an array of emails' });
    }

    // Normalize incoming contacts
    const normalizedContacts = [...new Set(contacts.map(email => email.toLowerCase().trim()))];

    // Find registered users from the normalized list
    const registeredUsers = await User.find({
      email: { $in: normalizedContacts },
      _id: { $ne: req.user._id } // exclude self
    }).select('_id username email avatar bio lastSeen onlineStatus profileCompleted');

    // Identify which emails are NOT registered
    const registeredEmails = registeredUsers.map(u => u.email);
    const inviteContacts = normalizedContacts.filter(
      email => !registeredEmails.includes(email) && email !== req.user.email
    );

    // Save registered users as contacts for the current user
    const user = await User.findById(req.user._id);
    if (user) {
      const existingContactIds = user.contacts.map(id => id.toString());
      const newContactIds = registeredUsers.map(u => u._id.toString());
      
      const updatedContacts = [...new Set([...existingContactIds, ...newContactIds])];
      user.contacts = updatedContacts;
      await user.save();
    }

    res.json({
      registeredUsers,
      inviteContacts
    });
  } catch (error) {
    console.error('Contact Sync Error:', error);
    res.status(500).json({ message: 'Failed to sync contacts' });
  }
};

module.exports = { syncContacts };

const User = require('../models/User');
const { parsePhoneNumberFromString } = require('libphonenumber-js'); // or google-libphonenumber if installed directly

// Helper to normalize phone number
const normalizePhone = (phone) => {
  try {
    const phoneNumber = parsePhoneNumberFromString(phone);
    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.format('E.164');
    }
    // Fallback basic normalization if libphonenumber fails
    const basic = phone.replace(/[^0-9+]/g, '');
    return basic.startsWith('+') ? basic : `+${basic}`;
  } catch (err) {
    return phone;
  }
};

const syncContacts = async (req, res) => {
  try {
    const { contacts } = req.body; // Expects array of phone number strings

    if (!Array.isArray(contacts)) {
      return res.status(400).json({ message: 'Contacts must be an array of phone numbers' });
    }

    // Normalize incoming contacts
    const normalizedContacts = [...new Set(contacts.map(normalizePhone))];

    // Find registered users from the normalized list
    const registeredUsers = await User.find({
      phoneNumber: { $in: normalizedContacts },
      _id: { $ne: req.user._id } // exclude self
    }).select('_id username phoneNumber email avatar bio lastSeen onlineStatus profileCompleted');

    // Identify which numbers are NOT registered
    const registeredPhones = registeredUsers.map(u => u.phoneNumber);
    const inviteContacts = normalizedContacts.filter(
      phone => !registeredPhones.includes(phone) && phone !== req.user.phoneNumber
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

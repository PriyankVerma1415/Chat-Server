const User = require('../models/User');

const getUsers = async (req, res) => {
  try {
    const keyword = req.query.search
      ? {
          $or: [
            { username: { $regex: req.query.search, $options: 'i' } },
            { email: { $regex: req.query.search, $options: 'i' } },
          ],
        }
      : {};

    const users = await User.find(keyword)
      .find({ _id: { $ne: req.user._id } })
      .select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.username = req.body.username || user.username;
      user.bio = req.body.bio || user.bio;
      user.avatar = req.body.avatar || user.avatar;
      
      // If the user just completed setting up their profile
      if (req.body.username || req.body.avatar) {
        user.profileCompleted = true;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        phoneNumber: updatedUser.phoneNumber,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        bio: updatedUser.bio,
        profileCompleted: updatedUser.profileCompleted,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getUsers, updateProfile };

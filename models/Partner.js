const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    name: { type: String, required: true },
    institution: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    message: { type: String, required: true },
    attachment: { type: String }, 
    status: { type: String, default: 'New Lead' },
});

module.exports = mongoose.model('Partner', partnerSchema);
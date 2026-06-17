const mongoose = require('mongoose');

const flightLogSchema = new mongoose.Schema({
    throt: { type: Number },
    v_km_h: { type: Number },
    mot_rpm: { type: Number },
    alt: { type: Number },
    roll_deg: { type: Number },
    pitch_deg: { type: Number },
    yaw_deg: { type: Number },
    batt_pctg: { type: Number },
    curr_charge: { type: Number },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FlightLog', flightLogSchema);
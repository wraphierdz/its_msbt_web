const express = require('express');
const path = require('path');
const app = express();
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const Admin = require('./models/Admin');
const Partner = require('./models/Partner');
const FlightLog = require('./models/FlightLog');

// setup folder upload
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// koneksi db
const dbUri = process.env.MONGODB_URI || 'mongodb+srv://wijdanrazefi99_db_user:1ECNQPcUXecL67VW@cluster0.inqqsmg.mongodb.net/?appName=Cluster0';
mongoose.connect(dbUri)
    .then(() => console.log('database connected'))
    .catch(err => console.log('db error', err));

// config express
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// session and auth
app.use(session({
    secret: 'kunci_rahasia_msbt_2026',
    resave: false,
    saveUninitialized: false
}));

const cekLogin = (req, res, next) => {
    req.session.adminId ? next() : res.redirect('/login');
};

// ROUTES

// auth
app.get('/register', (req, res) => res.render('register'));
app.post('/register', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        await new Admin({ username: req.body.username, password: hashedPassword }).save();
        res.redirect('/login');
    } catch (e) { res.send("Register failed"); }
});

app.get('/login', (req, res) => req.session.adminId ? res.redirect('/dashboard') : res.render('login'));
app.post('/login', async (req, res) => {
    const admin = await Admin.findOne({ username: req.body.username });
    if (admin && await bcrypt.compare(req.body.password, admin.password)) {
        req.session.adminId = admin._id;
        res.redirect('/dashboard');
    } else { res.send("login salah"); }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// public pages
app.get('/', (req, res) => res.render('index'));
app.get('/our-boat', (req, res) => res.render('our-boat'));
app.get('/competition', (req, res) => res.render('competition'));
app.get('/partner', (req, res) => res.render('partner'));

// partners api
app.post('/partner', upload.single('attachment'), async (req, res) => {
    try {
        await new Partner({ ...req.body, attachment: req.file ? req.file.filename : null }).save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// dashboard (admin area)
app.get('/dashboard', cekLogin, async (req, res) => {
    const data = await Partner.find().sort({ date: -1 });
    res.render('dashboard', { partners: data });
});

app.delete('/partner/:id', cekLogin, async (req, res) => {
    await Partner.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

app.put('/partner/status/:id', cekLogin, async (req, res) => {
    await Partner.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ success: true });
});

// telemetry
app.get('/flight-log', cekLogin, async (req, res) => {
    const logs = await FlightLog.find().sort({ timestamp: -1 }).limit(50);
    res.render('flight-log', { logs });
});

app.post('/api/flight-log/simulate', cekLogin, async (req, res) => {
    await new FlightLog({
        throt: Math.floor(Math.random() * 60 + 40),
        v_km_h: (Math.random() * 15 + 20).toFixed(1),
        mot_rpm: Math.floor(Math.random() * 1500 + 1500),
        alt: (Math.random() * 1 + 0.5).toFixed(2),
        roll_deg: (Math.random() * 10 - 5).toFixed(1),
        pitch_deg: (Math.random() * 8 - 4).toFixed(1),
        yaw_deg: Math.floor(Math.random() * 360),
        batt_pctg: Math.floor(Math.random() * 100),
        curr_charge: (Math.random() * 50).toFixed(1)
    }).save();
    res.json({ success: true });
});

// export pdf partner
app.get('/export/pdf', cekLogin, async (req, res) => {
    try {
        const partners = await Partner.find().sort({ date: -1 });
        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="partner_leads.pdf"');
        doc.pipe(res);

        doc.fontSize(20).text('Daftar Partner Leads', { align: 'center' });
        doc.moveDown();

        partners.forEach((p, index) => {
            // Menambahkan Date
            const tgl = p.date ? new Date(p.date).toLocaleDateString() : '-';
            doc.fontSize(12).text(`${index + 1}. [${tgl}] Nama: ${p.name}`);
            
            doc.text(`   Institusi: ${p.institution}`);
            doc.text(`   Email: ${p.email}`);
            doc.text(`   Telepon: ${p.phone}`);
            doc.text(`   Pesan: ${p.message}`);
            doc.text(`   Status: ${p.status}`);
            doc.moveDown();
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown();
        });

        doc.end();
    } catch (error) {
        res.status(500).send("Failed create PDF");
    }
});

// export xlsx partner
app.get('/export/excel', cekLogin, async (req, res) => {
    const partners = await Partner.find().sort({ date: -1 });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sponsor Leads');
    
    ws.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Nama', key: 'name', width: 20 },
        { header: 'Institusi', key: 'institution', width: 20 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Telepon', key: 'phone', width: 15 },
        { header: 'Pesan', key: 'message', width: 30 },
        { header: 'Status', key: 'status', width: 15 }
    ];

    partners.forEach(p => {
        ws.addRow({
            date: p.date ? p.date.toLocaleDateString() : '-',
            institution: p.institution,
            email: p.email,
            phone: p.phone,
            message: p.message,
            status: p.status
        });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=partners.xlsx');
    await wb.xlsx.write(res);
    res.end();
});

// export pdf flight-log
app.get('/export/flight-log/pdf', cekLogin, async (req, res) => {
    try {
        const logs = await FlightLog.find().sort({ timestamp: -1 }).limit(50);
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="flight_log_report.pdf"');
        doc.pipe(res);

        doc.fontSize(16).text('JALAPATIH TELEMETRY FLIGHT LOG', { align: 'center' });
        doc.moveDown();

        // header tabel
        const startX = 30;
        let startY = 100;
        const rowHeight = 20;
        
        doc.fontSize(10).font('Helvetica-Bold');
        const headers = ['TIMESTAMP', 'THROT', 'SPD', 'RPM', 'ALT', 'ROLL', 'PTCH', 'YAW', 'BATT', 'CHRG'];
        const colWidths = [150, 40, 40, 50, 40, 40, 40, 40, 40, 40];

        headers.forEach((h, i) => {
            doc.text(h, startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), startY);
        });

        doc.moveTo(startX, startY + 15).lineTo(780, startY + 15).stroke();

        // isi data
        doc.font('Helvetica');
        startY += rowHeight;
        
        logs.forEach((l, index) => {
            const y = startY + (index * rowHeight);
            if (y > 550) return;

            const rowData = [
                new Date(l.timestamp).toLocaleString(),
                l.throt, l.v_km_h, l.mot_rpm, l.alt, 
                l.roll_deg, l.pitch_deg, l.yaw_deg, l.batt_pctg, l.curr_charge
            ];

            rowData.forEach((data, i) => {
                doc.text(String(data), startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y);
            });
        });

        doc.end();
    } catch (error) {
        res.status(500).send("Failed create PDF");
    }
});

// export csv flight-log
app.get('/export/flight-log/csv', cekLogin, async (req, res) => {
    const logs = await FlightLog.find().sort({ timestamp: -1 });
    const { Parser } = require('json2csv');
    const parser = new Parser();
    const csv = parser.parse(JSON.parse(JSON.stringify(logs)));
    
    res.header('Content-Type', 'text/csv');
    res.attachment('flight-log.csv');
    res.send(csv);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('server running on port ' + PORT));

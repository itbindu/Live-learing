// routes/attendanceRoutes.js
const express = require("express");
const router = express.Router();

// In-memory attendance storage (replace with database in production)
let attendanceDB = {};

router.post("/record", (req, res) => {
  const { meetingId, type, record } = req.body;

  if (!meetingId || !type || !record) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!attendanceDB[meetingId]) {
    attendanceDB[meetingId] = [];
  }

  let records = attendanceDB[meetingId];

  const existingIndex = records.findIndex(r =>
    r.userId === record.userId && !r.leftAt && r.isActive !== false
  );

  if (type === "join") {
    // Prevent duplicate join
    if (existingIndex === -1) {
      records.push({
        ...record,
        joinedAt: record.joinedAt || new Date().toISOString(),
        isActive: true,
        leftAt: null,
        duration: null
      });
      console.log(`✅ Attendance join recorded for ${record.userName} in meeting ${meetingId}`);
    } else {
      console.log(`⚠️ Skipping duplicate join for ${record.userName} in meeting ${meetingId}`);
    }
  }

  if (type === "leave") {
    if (existingIndex !== -1) {
      const leftAt = record.leftAt || new Date().toISOString();
      const joinedAt = records[existingIndex].joinedAt;
      const duration = Math.round((new Date(leftAt) - new Date(joinedAt)) / 1000);

      records[existingIndex] = {
        ...records[existingIndex],
        leftAt: leftAt,
        duration: duration,
        isActive: false
      };
      console.log(`✅ Attendance leave recorded for ${record.userName} in meeting ${meetingId}, Duration: ${duration}s`);
    }
  }

  res.json({ 
    success: true, 
    message: `${type} recorded successfully`,
    records: attendanceDB[meetingId]
  });
});

// Get attendance records for a meeting
router.get("/meeting/:meetingId", (req, res) => {
  const { meetingId } = req.params;
  
  if (!attendanceDB[meetingId]) {
    return res.json({ success: true, records: [] });
  }
  
  res.json({ 
    success: true, 
    records: attendanceDB[meetingId] 
  });
});

// Get all meetings (for teacher dashboard)
router.get("/all", (req, res) => {
  const meetings = Object.keys(attendanceDB).map(meetingId => ({
    meetingId,
    records: attendanceDB[meetingId],
    participantCount: attendanceDB[meetingId].length
  }));
  
  res.json({ success: true, meetings });
});

// Clear attendance data (for testing)
router.delete("/clear/:meetingId", (req, res) => {
  const { meetingId } = req.params;
  
  if (attendanceDB[meetingId]) {
    delete attendanceDB[meetingId];
    res.json({ success: true, message: `Attendance data cleared for meeting ${meetingId}` });
  } else {
    res.json({ success: true, message: "No data to clear" });
  }
});

module.exports = router;
const express = require("express");
const router = express.Router();

let attendanceDB = {};

router.post("/record", (req, res) => {
  const { meetingId, type, record } = req.body;

  if (!attendanceDB[meetingId]) {
    attendanceDB[meetingId] = [];
  }

  let records = attendanceDB[meetingId];

  const existingIndex = records.findIndex(r =>
    r.userId === record.userId && !r.leftAt
  );

  if (type === "join") {
    if (existingIndex === -1) {
      records.push({
        ...record,
        joinedAt: new Date().toISOString()
      });
    }
  }

  if (type === "leave") {
    if (existingIndex !== -1) {
      records[existingIndex].leftAt = new Date().toISOString();
    }
  }

  res.json({ success: true });
});

module.exports = router;
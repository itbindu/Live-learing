// routes/attendanceRoutes.js
const express = require("express");
const router = express.Router();
const Meeting = require("../Models/Meeting");

// ================= SAVE ATTENDANCE TO MONGODB =================
router.post("/record", async (req, res) => {
  const { meetingId, type, record } = req.body;

  if (!meetingId || !type || !record) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Find the meeting in MongoDB
    let meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      // Create meeting if it doesn't exist
      meeting = new Meeting({
        meetingId,
        title: record.meetingTitle || "Virtual Classroom",
        teacherId: record.teacherId || null,
        participants: [],
        attendance: []
      });
    }

    if (type === "join") {
      // Check if user already has an active session
      const existingRecord = meeting.attendance.find(
        a => a.userId === record.userId && a.isActive === true
      );

      if (!existingRecord) {
        meeting.attendance.push({
          userId: record.userId,
          userName: record.userName,
          email: record.email || "",
          role: record.role || "student",
          joinedAt: record.joinedAt || new Date(),
          isActive: true,
          leftAt: null,
          duration: null
        });
        
        // Also add to participants array for compatibility
        meeting.participants.push({
          name: record.userName,
          email: record.email || "",
          joinedAt: new Date()
        });
        
        console.log(`✅ Attendance join recorded for ${record.userName} in meeting ${meetingId}`);
      }
    }

    if (type === "leave") {
      // Find active record for this user
      const activeRecord = meeting.attendance.find(
        a => a.userId === record.userId && a.isActive === true
      );

      if (activeRecord) {
        const leftAt = record.leftAt || new Date();
        const joinTime = new Date(activeRecord.joinedAt).getTime();
        const leaveTime = new Date(leftAt).getTime();
        const duration = Math.round((leaveTime - joinTime) / 1000);

        activeRecord.leftAt = leftAt;
        activeRecord.duration = duration;
        activeRecord.isActive = false;
        
        console.log(`✅ Attendance leave recorded for ${record.userName} in meeting ${meetingId}, Duration: ${duration}s`);
      }
    }

    await meeting.save();
    res.json({ success: true, records: meeting.attendance });

  } catch (error) {
    console.error("Error saving attendance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================= GET ATTENDANCE FOR A MEETING =================
router.get("/:meetingId", async (req, res) => {
  const { meetingId } = req.params;

  try {
    const meeting = await Meeting.findOne({ meetingId });
    
    if (!meeting) {
      return res.json({ records: [] });
    }
    
    res.json({ records: meeting.attendance || [] });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================= GET ALL MEETINGS WITH ATTENDANCE =================
router.get("/all", async (req, res) => {
  try {
    const meetings = await Meeting.find({}).sort({ createdAt: -1 });
    
    const meetingData = meetings.map(meeting => ({
      meetingId: meeting.meetingId,
      records: meeting.attendance || [],
      participants: meeting.participants || [],
      createdAt: meeting.createdAt,
      isActive: meeting.isActive
    }));
    
    res.json({ success: true, meetings: meetingData });
  } catch (error) {
    console.error("Error fetching all meetings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ================= GET MEETING SUMMARY =================
router.get("/summary/:meetingId", async (req, res) => {
  const { meetingId } = req.params;

  try {
    const meeting = await Meeting.findOne({ meetingId });
    
    if (!meeting) {
      return res.json({ 
        success: true, 
        summary: {
          totalParticipants: 0,
          activeParticipants: 0,
          averageDuration: 0,
          attendance: []
        }
      });
    }
    
    const attendance = meeting.attendance || [];
    const totalParticipants = attendance.length;
    const activeParticipants = attendance.filter(a => a.isActive === true).length;
    
    const completedSessions = attendance.filter(a => a.duration);
    const totalDuration = completedSessions.reduce((sum, a) => sum + (a.duration || 0), 0);
    const averageDuration = completedSessions.length > 0 
      ? Math.round(totalDuration / completedSessions.length) 
      : 0;
    
    res.json({
      success: true,
      summary: {
        totalParticipants,
        activeParticipants,
        averageDuration,
        attendance
      }
    });
  } catch (error) {
    console.error("Error fetching meeting summary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
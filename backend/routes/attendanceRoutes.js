// routes/attendanceRoutes.js
const express = require("express");
const router = express.Router();
const Meeting = require("../Models/Meeting");

// ================= GET ALL MEETINGS WITH ATTENDANCE (MUST COME FIRST) =================
router.get("/all", async (req, res) => {
  console.log("📊 Fetching ALL meetings with attendance");
  console.log("=" .repeat(50));

  try {
    // Find ALL meetings - don't filter anything
    const meetings = await Meeting.find({}).sort({ createdAt: -1 });
    
    console.log(`✅ Found ${meetings.length} total meetings in database`);
    
    // Log each meeting for debugging
    meetings.forEach((meeting, index) => {
      console.log(`\n📌 Meeting ${index + 1}:`);
      console.log(`   ID: ${meeting.meetingId}`);
      console.log(`   Title: ${meeting.title}`);
      console.log(`   Attendance count: ${meeting.attendance?.length || 0}`);
      console.log(`   Is Active: ${meeting.isActive}`);
    });
    
    // Format the response
    const meetingData = meetings.map(meeting => ({
      meetingId: meeting.meetingId,
      title: meeting.title,
      records: meeting.attendance || [],
      participants: meeting.participants || [],
      createdAt: meeting.createdAt,
      isActive: meeting.isActive,
      endedAt: meeting.endedAt
    }));
    
    console.log("\n✅ Sending response with", meetingData.length, "meetings");
    
    res.json({ 
      success: true, 
      meetings: meetingData 
    });
  } catch (error) {
    console.error("❌ Error fetching all meetings:", error);
    res.status(500).json({ 
      error: "Internal server error", 
      details: error.message,
      success: false 
    });
  }
});

// ================= GET ATTENDANCE FOR A SPECIFIC MEETING =================
router.get("/:meetingId", async (req, res) => {
  const { meetingId } = req.params;
  console.log(`📊 Fetching attendance for meeting: ${meetingId}`);

  // Skip if it's the "all" endpoint (already handled above)
  if (meetingId === "all") {
    console.log("⚠️ Skipping - this should be handled by /all route");
    return;
  }

  try {
    const meeting = await Meeting.findOne({ meetingId });
    
    if (!meeting) {
      console.log(`⚠️ No meeting found for ${meetingId}`);
      return res.json({ 
        success: true, 
        records: [],
        meeting: null
      });
    }
    
    console.log(`✅ Found meeting: ${meetingId}`);
    console.log(`   Title: ${meeting.title}`);
    console.log(`   Attendance records: ${meeting.attendance?.length || 0}`);
    console.log(`   Is Active: ${meeting.isActive}`);
    
    res.json({ 
      success: true, 
      records: meeting.attendance || [],
      meeting: {
        id: meeting.meetingId,
        title: meeting.title,
        isActive: meeting.isActive,
        createdAt: meeting.createdAt,
        endedAt: meeting.endedAt
      }
    });
  } catch (error) {
    console.error("❌ Error fetching attendance:", error);
    res.status(500).json({ error: "Internal server error", success: false });
  }
});

// ================= SAVE ATTENDANCE TO MONGODB =================
router.post("/record", async (req, res) => {
  console.log("=" .repeat(50));
  console.log("📝 ATTENDANCE RECORD REQUEST RECEIVED");
  console.log("Meeting ID:", req.body.meetingId);
  console.log("Type:", req.body.type);
  console.log("User:", req.body.record?.userName);
  console.log("=" .repeat(50));
  
  const { meetingId, type, record } = req.body;

  if (!meetingId || !type || !record) {
    return res.status(400).json({ error: "Missing required fields", success: false });
  }

  try {
    let meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      console.log(`⚠️ Meeting ${meetingId} not found, creating new...`);
      meeting = new Meeting({
        meetingId,
        title: record.meetingTitle || "Virtual Classroom",
        teacherId: record.teacherId || null,
        participants: [],
        attendance: []
      });
      await meeting.save();
      console.log(`✅ Created new meeting: ${meetingId}`);
    } else {
      console.log(`✅ Found existing meeting: ${meetingId}`);
      console.log(`   Current attendance count: ${meeting.attendance?.length || 0}`);
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
        
        meeting.participants.push({
          name: record.userName,
          email: record.email || "",
          joinedAt: new Date()
        });
        
        await meeting.save();
        console.log(`✅ Attendance join recorded for ${record.userName}`);
        console.log(`   New attendance count: ${meeting.attendance.length}`);
      } else {
        console.log(`⚠️ User ${record.userName} already has active attendance`);
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
        
        await meeting.save();
        console.log(`✅ Attendance leave recorded for ${record.userName}`);
        console.log(`   Duration: ${duration} seconds`);
      } else {
        console.log(`⚠️ No active attendance found for ${record.userName}`);
      }
    }

    res.json({ success: true, records: meeting.attendance });

  } catch (error) {
    console.error("❌ Error saving attendance:", error);
    res.status(500).json({ error: "Internal server error", success: false });
  }
});

// ================= GET TEACHER'S MEETINGS WITH ATTENDANCE =================
router.get("/teacher/:teacherId", async (req, res) => {
  const { teacherId } = req.params;
  console.log(`📊 Fetching attendance for teacher: ${teacherId}`);

  try {
    const meetings = await Meeting.find({ teacherId }).sort({ createdAt: -1 });
    
    console.log(`✅ Found ${meetings.length} meetings for teacher`);
    
    const formattedMeetings = meetings.map(meeting => ({
      meetingId: meeting.meetingId,
      title: meeting.title,
      records: meeting.attendance || [],
      participants: meeting.participants || [],
      createdAt: meeting.createdAt,
      isActive: meeting.isActive,
      endedAt: meeting.endedAt
    }));
    
    res.json({ 
      success: true, 
      meetings: formattedMeetings 
    });
  } catch (error) {
    console.error("❌ Error fetching teacher attendance:", error);
    res.status(500).json({ success: false, error: "Failed to fetch attendance" });
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

// ================= DELETE MEETING ATTENDANCE =================
router.delete("/clear/:meetingId", async (req, res) => {
  const { meetingId } = req.params;

  try {
    const result = await Meeting.findOneAndDelete({ meetingId });
    
    if (result) {
      res.json({ success: true, message: `Meeting ${meetingId} attendance cleared` });
    } else {
      res.json({ success: true, message: "No meeting found to clear" });
    }
  } catch (error) {
    console.error("Error clearing attendance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
// routes/attendanceRoutes.js
const express = require("express");
const router = express.Router();
const Meeting = require("../Models/Meeting");

// ================= GET ALL MEETINGS WITH ATTENDANCE =================
router.get("/all", async (req, res) => {
  console.log("📊 Fetching ALL meetings with attendance");
  console.log("=" .repeat(50));

  try {
    const meetings = await Meeting.find({}).sort({ createdAt: -1 });
    
    console.log(`✅ Found ${meetings.length} total meetings in database`);
    
    meetings.forEach((meeting, index) => {
      console.log(`\n📌 Meeting ${index + 1}:`);
      console.log(`   ID: ${meeting.meetingId}`);
      console.log(`   Title: ${meeting.title}`);
      console.log(`   Attendance count: ${meeting.attendance?.length || 0}`);
      console.log(`   Is Active: ${meeting.isActive}`);
    });
    
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

// ================= JOIN MEETING - RECORD ATTENDANCE =================
router.post("/join", async (req, res) => {
  console.log("=" .repeat(50));
  console.log("🔵 JOIN ATTENDANCE REQUEST");
  console.log("Body:", req.body);
  console.log("=" .repeat(50));
  
  const { meetingId, userId, userName, email, role } = req.body;

  if (!meetingId || !userId || !userName) {
    return res.status(400).json({ 
      error: "Missing required fields", 
      success: false,
      required: ["meetingId", "userId", "userName"]
    });
  }

  try {
    let meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      console.log(`⚠️ Meeting ${meetingId} not found, creating new...`);
      meeting = new Meeting({
        meetingId,
        title: "Virtual Classroom",
        teacherId: null,
        participants: [],
        attendance: []
      });
      await meeting.save();
      console.log(`✅ Created new meeting: ${meetingId}`);
    }

    // Check if user already has an active session
    const existingActive = meeting.attendance.find(
      a => a.userId === userId && a.isActive === true
    );

    if (existingActive) {
      console.log(`⚠️ User ${userName} already has active attendance in this meeting`);
      return res.json({ 
        success: true, 
        message: "User already has active attendance",
        alreadyActive: true,
        record: existingActive
      });
    }

    // Add new attendance record
    const newRecord = {
      userId: userId,
      userName: userName,
      email: email || "",
      role: role || "student",
      joinedAt: new Date(),
      isActive: true,
      leftAt: null,
      duration: null
    };
    
    meeting.attendance.push(newRecord);
    
    // Also add to participants for compatibility
    meeting.participants.push({
      name: userName,
      email: email || "",
      joinedAt: new Date()
    });
    
    await meeting.save();
    
    console.log(`✅ JOIN recorded for ${userName} in meeting ${meetingId}`);
    console.log(`   Attendance count: ${meeting.attendance.length}`);
    
    res.json({ 
      success: true, 
      message: "Join recorded successfully",
      record: newRecord,
      attendanceCount: meeting.attendance.length
    });

  } catch (error) {
    console.error("❌ Error recording join:", error);
    res.status(500).json({ error: "Internal server error", success: false });
  }
});

// ================= LEAVE MEETING - RECORD ATTENDANCE =================
router.post("/leave", async (req, res) => {
  console.log("=" .repeat(50));
  console.log("🔴 LEAVE ATTENDANCE REQUEST");
  console.log("Body:", req.body);
  console.log("=" .repeat(50));
  
  const { meetingId, userId } = req.body;

  if (!meetingId || !userId) {
    return res.status(400).json({ 
      error: "Missing required fields", 
      success: false,
      required: ["meetingId", "userId"]
    });
  }

  try {
    const meeting = await Meeting.findOne({ meetingId });
    
    if (!meeting) {
      console.log(`⚠️ Meeting ${meetingId} not found`);
      return res.status(404).json({ error: "Meeting not found", success: false });
    }

    // Find active attendance record for this user
    const activeRecord = meeting.attendance.find(
      a => a.userId === userId && a.isActive === true
    );

    if (!activeRecord) {
      console.log(`⚠️ No active attendance found for user ${userId}`);
      return res.json({ 
        success: true, 
        message: "No active attendance found",
        alreadyLeft: true
      });
    }

    // Calculate duration
    const leftAt = new Date();
    const joinTime = new Date(activeRecord.joinedAt).getTime();
    const leaveTime = leftAt.getTime();
    const duration = Math.round((leaveTime - joinTime) / 1000);

    // Update the record
    activeRecord.leftAt = leftAt;
    activeRecord.duration = duration;
    activeRecord.isActive = false;
    
    await meeting.save();
    
    console.log(`✅ LEAVE recorded for ${activeRecord.userName} in meeting ${meetingId}`);
    console.log(`   Duration: ${duration} seconds (${Math.floor(duration / 60)} minutes ${duration % 60} seconds)`);
    
    res.json({ 
      success: true, 
      message: "Leave recorded successfully",
      record: {
        userId: activeRecord.userId,
        userName: activeRecord.userName,
        joinedAt: activeRecord.joinedAt,
        leftAt: leftAt,
        duration: duration
      }
    });

  } catch (error) {
    console.error("❌ Error recording leave:", error);
    res.status(500).json({ error: "Internal server error", success: false });
  }
});

// ================= GET ATTENDANCE FOR A SPECIFIC MEETING =================
router.get("/:meetingId", async (req, res) => {
  const { meetingId } = req.params;
  console.log(`📊 Fetching attendance for meeting: ${meetingId}`);

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
/* NOOR School Management — AL Noor Demo Hub Pre-seeded Dataset & Isolated Multi-Tenant Storage.
   Provides:
   1. 22 Teachers with period schedules, employee codes, and live statuses
   2. 100 Students (5 per class in Classes 1–10, Sections A & B), with exact Class 8 Section B students:
      Ayesha Khan (801), Mohammad Zaid (802), Sana Fatima (803), Arjun Mehta (804), Ibrahim Ali (805)
   3. Strict school-isolation: Real user-created schools start empty with 0 demo data.
*/
(()=>{'use strict';
window.NOOR_PRINCIPAL_SAMPLE = {
  students: 1250,
  present: 1128,
  staff: 64,
  staffPresent: 58,
  tasks: 12,
  approvals: 4,
  events: 3,
  health: 92,
  trend: [72, 81, 76, 86, 82, 91, 88],
  classes: [['Class 6', 91], ['Class 7', 88], ['Class 8', 82], ['Class 9', 94], ['Class 10', 89]],
  subjects: [['English', 86], ['Maths', 78], ['Science', 91], ['Social', 84], ['Languages', 88]]
};

// 22 Teachers for AL Noor Demo Hub
const DEMO_TEACHERS = [
  { id: 'tch-01', name: 'Syeda Aafra Fathima', email: 'thinkandgrow437@gmail.com', phone: '+91 98765 43210', code: 'TCH-2026-014', qual: 'M.Sc. Mathematics, B.Ed.', subject: 'Mathematics', classLabel: 'Class 8 - Section B', startTime: '08:50', endTime: '09:35', status: 'Ongoing', checkIn: '08:02 AM', checkInStatus: 'present' },
  { id: 'tch-02', name: 'Ms. Fathima Ali', email: 'fathima.ali@alnoor.demo', phone: '+91 98765 43211', code: 'TCH-ALN-001', qual: 'M.Sc. Mathematics', subject: 'Mathematics', classLabel: 'Class 8 - Section A', startTime: '09:00', endTime: '10:00', status: 'Teaching', checkIn: '08:05 AM', checkInStatus: 'present' },
  { id: 'tch-03', name: 'Mr. Aamir Khan', email: 'aamir.khan@alnoor.demo', phone: '+91 98765 43212', code: 'TCH-ALN-002', qual: 'M.A. History', subject: 'History', classLabel: 'Class 10 - Section B', startTime: '10:00', endTime: '11:00', status: 'Teaching', checkIn: '08:10 AM', checkInStatus: 'present' },
  { id: 'tch-04', name: 'Dr. Sarah Khan', email: 'sarah.khan@alnoor.demo', phone: '+91 98765 43213', code: 'TCH-ALN-003', qual: 'Ph.D. Physics', subject: 'Physics', classLabel: 'Class 10 - Section A', startTime: '09:00', endTime: '10:00', status: 'Teaching', checkIn: '08:12 AM', checkInStatus: 'present' },
  { id: 'tch-05', name: 'Mrs. Sana Begum', email: 'sana.begum@alnoor.demo', phone: '+91 98765 43214', code: 'TCH-ALN-004', qual: 'M.A. English, B.Ed.', subject: 'English', classLabel: 'Class 7 - Section B', startTime: '11:00', endTime: '12:00', status: 'Available', checkIn: '08:15 AM', checkInStatus: 'present' },
  { id: 'tch-06', name: 'Mr. Imran Siddiqui', email: 'imran.siddiqui@alnoor.demo', phone: '+91 98765 43215', code: 'TCH-ALN-005', qual: 'M.Sc. Chemistry', subject: 'Chemistry', classLabel: 'Class 9 - Section A', startTime: '12:00', endTime: '13:00', status: 'Teaching', checkIn: '08:15 AM', checkInStatus: 'present' },
  { id: 'tch-07', name: 'Mrs. Nida Ahmed', email: 'nida.ahmed@alnoor.demo', phone: '+91 98765 43216', code: 'TCH-ALN-006', qual: 'M.A. Urdu', subject: 'Urdu', classLabel: 'Class 6 - Section A', startTime: '10:00', endTime: '11:00', status: 'Available', checkIn: '08:20 AM', checkInStatus: 'present' },
  { id: 'tch-08', name: 'Mrs. Sharma', email: 'sharma.english@alnoor.demo', phone: '+91 98765 43217', code: 'TCH-ALN-007', qual: 'B.A. English, B.Ed.', subject: 'English', classLabel: 'Class 8 - Section B', startTime: '08:00', endTime: '08:45', status: 'Completed', checkIn: '07:55 AM', checkInStatus: 'present' },
  { id: 'tch-09', name: 'Ms. Patil', email: 'patil.science@alnoor.demo', phone: '+91 98765 43218', code: 'TCH-ALN-008', qual: 'M.Sc. Biology', subject: 'Science', classLabel: 'Class 8 - Section B', startTime: '09:45', endTime: '10:30', status: 'Upcoming', checkIn: '08:00 AM', checkInStatus: 'present' },
  { id: 'tch-10', name: 'Mr. Roy', email: 'roy.history@alnoor.demo', phone: '+91 98765 43219', code: 'TCH-ALN-009', qual: 'M.A. Geography', subject: 'Social Studies', classLabel: 'Class 8 - Section B', startTime: '10:40', endTime: '11:25', status: 'Upcoming', checkIn: '08:10 AM', checkInStatus: 'present' },
  { id: 'tch-11', name: 'Dr. Ayesha Rehman', email: 'ayesha.rehman@alnoor.demo', phone: '+91 98765 43220', code: 'TCH-ALN-010', qual: 'Ph.D. Physics', subject: 'Physics', classLabel: 'Class 9 - Section A', startTime: '11:30', endTime: '12:15', status: 'Upcoming', checkIn: '08:14 AM', checkInStatus: 'present' },
  { id: 'tch-12', name: 'Mr. Tariq Anwar', email: 'tariq.anwar@alnoor.demo', phone: '+91 98765 43221', code: 'TCH-ALN-011', qual: 'M.Sc. Mathematics', subject: 'Mathematics', classLabel: 'Class 5 - Section A', startTime: '08:50', endTime: '09:35', status: 'Teaching', checkIn: '08:05 AM', checkInStatus: 'present' },
  { id: 'tch-13', name: 'Ms. Farah Ali', email: 'farah.ali@alnoor.demo', phone: '+91 98765 43222', code: 'TCH-ALN-012', qual: 'M.A. English Literature', subject: 'English', classLabel: 'Class 2 - Section B', startTime: '09:40', endTime: '10:25', status: 'Upcoming', checkIn: '08:22 AM', checkInStatus: 'present' },
  { id: 'tch-14', name: 'Mr. Faisal Siddiqui', email: 'faisal.siddiqui@alnoor.demo', phone: '+91 98765 43223', code: 'TCH-ALN-013', qual: 'M.A. Political Science', subject: 'Social Studies', classLabel: 'Class 6 - Section B', startTime: '10:30', endTime: '11:15', status: 'Upcoming', checkIn: null, checkInStatus: 'leave' },
  { id: 'tch-15', name: 'Mrs. Hina Tariq', email: 'hina.tariq@alnoor.demo', phone: '+91 98765 43224', code: 'TCH-ALN-014', qual: 'M.Sc. Botany, B.Ed.', subject: 'Science', classLabel: 'Class 4 - Section A', startTime: '11:20', endTime: '12:05', status: 'Upcoming', checkIn: '08:08 AM', checkInStatus: 'present' },
  { id: 'tch-16', name: 'Prof. Zubair Ahmed', email: 'zubair.ahmed@alnoor.demo', phone: '+91 98765 43225', code: 'TCH-ALN-015', qual: 'M.Tech Computer Science', subject: 'Computer Science', classLabel: 'Class 10 - Section A', startTime: '12:10', endTime: '12:55', status: 'Upcoming', checkIn: '08:15 AM', checkInStatus: 'present' },
  { id: 'tch-17', name: 'Ms. Nadia Qureshi', email: 'nadia.qureshi@alnoor.demo', phone: '+91 98765 43226', code: 'TCH-ALN-016', qual: 'M.Sc. Statistics', subject: 'Mathematics', classLabel: 'Class 7 - Section A', startTime: '13:00', endTime: '13:45', status: 'Upcoming', checkIn: '08:30 AM', checkInStatus: 'present' },
  { id: 'tch-18', name: 'Mr. Kamran Baig', email: 'kamran.baig@alnoor.demo', phone: '+91 98765 43227', code: 'TCH-ALN-017', qual: 'M.P.Ed. Physical Education', subject: 'Physical Education', classLabel: 'Class 8 - Section A', startTime: '13:50', endTime: '14:35', status: 'Upcoming', checkIn: null, checkInStatus: 'absent' },
  { id: 'tch-19', name: 'Mrs. Zainab Bilgrami', email: 'zainab.bilgrami@alnoor.demo', phone: '+91 98765 43228', code: 'TCH-ALN-018', qual: 'M.A. Hindi, B.Ed.', subject: 'Hindi', classLabel: 'Class 5 - Section B', startTime: '09:00', endTime: '09:45', status: 'Teaching', checkIn: '08:04 AM', checkInStatus: 'present' },
  { id: 'tch-20', name: 'Mr. Salman Qureshi', email: 'salman.qureshi@alnoor.demo', phone: '+91 98765 43229', code: 'TCH-ALN-019', qual: 'M.F.A. Fine Arts', subject: 'Art & Design', classLabel: 'Class 3 - Section B', startTime: '10:00', endTime: '10:45', status: 'Upcoming', checkIn: '08:18 AM', checkInStatus: 'present' },
  { id: 'tch-21', name: 'Ms. Bushra Tabassum', email: 'bushra.tabassum@alnoor.demo', phone: '+91 98765 43230', code: 'TCH-ALN-020', qual: 'M.A. Islamic Studies', subject: 'Moral Science', classLabel: 'Class 2 - Section A', startTime: '11:00', endTime: '11:45', status: 'Upcoming', checkIn: '08:12 AM', checkInStatus: 'present' },
  { id: 'tch-22', name: 'Mr. Zeeshan Haider', email: 'zeeshan.haider@alnoor.demo', phone: '+91 98765 43231', code: 'TCH-ALN-021', qual: 'M.A. Economics, B.Ed.', subject: 'Economics', classLabel: 'Class 10 - Section B', startTime: '12:00', endTime: '12:45', status: 'Upcoming', checkIn: '08:25 AM', checkInStatus: 'present' }
];

// Generate 100 Students across Class 1 to 10, Sections A & B (5 students each)
const DEMO_STUDENTS = [];
const CLASS_8B_STUDENTS = [
  { roll: '801', name: 'Ayesha Khan', status: 'present', remarks: '-' },
  { roll: '802', name: 'Mohammad Zaid', status: 'present', remarks: '-' },
  { roll: '803', name: 'Sana Fatima', status: 'present', remarks: 'Sick leave' },
  { roll: '804', name: 'Arjun Mehta', status: 'absent', remarks: '-' },
  { roll: '805', name: 'Ibrahim Ali', status: 'late', remarks: 'Late (10 mins)' }
];

const FIRST_NAMES = ['Aarav', 'Anaya', 'Rayyan', 'Sara', 'Zoya', 'Kabir', 'Fatima', 'Rohan', 'Mariam', 'Hamza', 'Diya', 'Omar', 'Noor', 'Bilal', 'Alina', 'Farhan', 'Zara', 'Aditya', 'Sadia', 'Mustafa'];
const LAST_NAMES = ['Khan', 'Ahmed', 'Syed', 'Mehta', 'Sharma', 'Patel', 'Siddiqui', 'Shaikh', 'Ali', 'Ansari', 'Qureshi', 'Mirza', 'Hussain', 'Begum', 'Malik'];

for (let c = 1; c <= 10; c++) {
  for (const sec of ['Section A', 'Section B']) {
    for (let s = 1; s <= 5; s++) {
      if (c === 8 && sec === 'Section B') {
        const item = CLASS_8B_STUDENTS[s - 1];
        DEMO_STUDENTS.push({
          id: 'stu-8b-' + s,
          className: 'Class 8',
          classSort: 8,
          sectionName: 'Section B',
          roll: item.roll,
          name: item.name,
          email: item.name.toLowerCase().replace(/\s+/g, '.') + '.8b@alnoor.demo',
          phone: '+91 98765 8020' + s,
          guardian: 'Parent of ' + item.name,
          status: item.status,
          remarks: item.remarks
        });
      } else {
        const secLetter = sec.slice(-1);
        const rollNum = '' + c + (secLetter === 'A' ? '0' : '5') + s;
        const fn = FIRST_NAMES[(c * 3 + (secLetter === 'A' ? 0 : 7) + s) % FIRST_NAMES.length];
        const ln = LAST_NAMES[(c * 2 + s) % LAST_NAMES.length];
        const fullName = fn + ' ' + ln;
        const defaultStatus = (s === 4 && (c % 3 === 0)) ? 'absent' : (s === 5 && (c % 2 === 0)) ? 'late' : 'present';
        DEMO_STUDENTS.push({
          id: 'stu-' + c + secLetter.toLowerCase() + '-' + s,
          className: 'Class ' + c,
          classSort: c,
          sectionName: sec,
          roll: rollNum,
          name: fullName,
          email: fn.toLowerCase() + '.' + ln.toLowerCase() + '.' + c + secLetter.toLowerCase() + '@alnoor.demo',
          phone: '+91 98765 10' + c + s,
          guardian: 'Mr. ' + ln,
          status: defaultStatus,
          remarks: defaultStatus === 'late' ? 'Late (5 mins)' : defaultStatus === 'absent' ? 'Absent' : '-'
        });
      }
    }
  }
}

// Live in-memory repository for AL Noor Demo Hub with CRUD operations
window.NOOR_ALNOOR_HUB = {
  schoolId: 'sch-alnoor-2026',
  schoolName: 'AL Noor School Management',
  isDemoHub: true,
  teachers: DEMO_TEACHERS.slice(),
  students: DEMO_STUDENTS.slice(),

  getTeachers() {
    return this.teachers;
  },
  getTeacher(id) {
    return this.teachers.find(t => t.id === id || t.code === id);
  },
  addTeacher(t) {
    const id = 'tch-' + Date.now();
    const code = t.code || ('TCH-ALN-' + String(this.teachers.length + 1).padStart(3, '0'));
    const newT = {
      id,
      name: t.name || 'New Teacher',
      email: t.email || (t.name.toLowerCase().replace(/\s+/g, '.') + '@alnoor.demo'),
      phone: t.phone || '+91 98765 00000',
      code,
      qual: t.qual || 'B.Ed. Faculty',
      subject: t.subject || 'General Studies',
      classLabel: t.classLabel || 'Class 8 - Section B',
      startTime: t.startTime || '09:00',
      endTime: t.endTime || '10:00',
      status: 'Upcoming',
      checkIn: '08:15 AM',
      checkInStatus: 'present'
    };
    this.teachers.push(newT);
    return newT;
  },
  updateTeacher(id, updates) {
    const idx = this.teachers.findIndex(t => t.id === id);
    if (idx !== -1) {
      Object.assign(this.teachers[idx], updates);
      return this.teachers[idx];
    }
    return null;
  },
  removeTeacher(id) {
    const idx = this.teachers.findIndex(t => t.id === id);
    if (idx !== -1) {
      return this.teachers.splice(idx, 1)[0];
    }
    return null;
  },

  getStudents(className, sectionName) {
    let list = this.students;
    if (className) list = list.filter(s => s.className.toLowerCase() === className.toLowerCase() || s.className.endsWith(className));
    if (sectionName) list = list.filter(s => s.sectionName.toLowerCase() === sectionName.toLowerCase() || s.sectionName.endsWith(sectionName));
    return list;
  },
  addStudent(s) {
    const id = 'stu-' + Date.now();
    const newS = {
      id,
      className: s.className || 'Class 8',
      classSort: parseInt(s.className) || 8,
      sectionName: s.sectionName || 'Section B',
      roll: s.roll || ('R-' + Math.floor(100 + Math.random() * 900)),
      name: s.name || 'New Student',
      email: s.email || (s.name.toLowerCase().replace(/\s+/g, '.') + '@alnoor.demo'),
      phone: s.phone || '+91 98765 00000',
      guardian: s.guardian || 'Guardian',
      status: s.status || 'present',
      remarks: s.remarks || '-'
    };
    this.students.push(newS);
    return newS;
  },
  updateStudent(id, updates) {
    const idx = this.students.findIndex(s => s.id === id);
    if (idx !== -1) {
      Object.assign(this.students[idx], updates);
      return this.students[idx];
    }
    return null;
  },
  removeStudent(id) {
    const idx = this.students.findIndex(s => s.id === id);
    if (idx !== -1) {
      return this.students.splice(idx, 1)[0];
    }
    return null;
  },
  markAllPresent(className, sectionName) {
    this.getStudents(className, sectionName).forEach(s => {
      s.status = 'present';
    });
  }
};
})();
export const ROLES = {
  GRAPHIC_DESIGNER: 'graphic_designer',
  VIDEO_EDITOR: 'video_editor',
};

export const ROLE_LABELS = {
  [ROLES.GRAPHIC_DESIGNER]: 'Graphic Designer',
  [ROLES.VIDEO_EDITOR]: 'Video Editor',
};

export const ROLE_OPTIONS = [
  { value: ROLES.GRAPHIC_DESIGNER, label: 'Graphic Designer' },
  { value: ROLES.VIDEO_EDITOR, label: 'Video Editor' },
];

export const ROLE_BADGE_STYLES = {
  [ROLES.GRAPHIC_DESIGNER]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [ROLES.VIDEO_EDITOR]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const CONTENT_TYPES = {
  POST: 'post',
  REEL: 'reel',
  STORY: 'story',
};

export const CONTENT_TYPE_LABELS = {
  [CONTENT_TYPES.POST]: 'Post',
  [CONTENT_TYPES.REEL]: 'Reel',
  [CONTENT_TYPES.STORY]: 'Story',
};

export const CONTENT_TYPE_BADGES = {
  [CONTENT_TYPES.POST]: 'bg-blue-50 text-blue-700 border-blue-200',
  [CONTENT_TYPES.REEL]: 'bg-purple-50 text-purple-700 border-purple-200',
  [CONTENT_TYPES.STORY]: 'bg-amber-50 text-amber-700 border-amber-200',
};

export const AVAILABILITY_TYPES = {
  AVAILABLE: 'available',
  HALF_DAY: 'half_day',
  LEAVE: 'leave',
  CUSTOM: 'custom',
};

export const AVAILABILITY_OPTIONS = [
  { value: AVAILABILITY_TYPES.AVAILABLE, label: 'Available (Full Day 100% Capacity)' },
  { value: AVAILABILITY_TYPES.HALF_DAY, label: 'Half Day (50% Capacity 0.5x)' },
  { value: AVAILABILITY_TYPES.LEAVE, label: 'Full Leave (0% Capacity 0x)' },
  { value: AVAILABILITY_TYPES.CUSTOM, label: 'Custom Capacity Override' },
];

export const AVAILABILITY_MULTIPLIERS = {
  [AVAILABILITY_TYPES.AVAILABLE]: 1.0,
  [AVAILABILITY_TYPES.HALF_DAY]: 0.5,
  [AVAILABILITY_TYPES.LEAVE]: 0.0,
};

export const SURPLUS_REASONS = {
  NO_ELIGIBLE_EMPLOYEE: 'NO_ELIGIBLE_EMPLOYEE',
  INSUFFICIENT_CAPACITY: 'INSUFFICIENT_CAPACITY',
  EMPLOYEES_ON_LEAVE: 'EMPLOYEES_ON_LEAVE',
  NO_WORKING_DAYS: 'NO_WORKING_DAYS',
  ROLE_NOT_CONFIGURED: 'ROLE_NOT_CONFIGURED',
  CAPACITY_RULE_MISSING: 'CAPACITY_RULE_MISSING',
};

export const SURPLUS_REASON_LABELS = {
  [SURPLUS_REASONS.NO_ELIGIBLE_EMPLOYEE]: 'No eligible active employees for role',
  [SURPLUS_REASONS.INSUFFICIENT_CAPACITY]: 'Insufficient available capacity in team',
  [SURPLUS_REASONS.EMPLOYEES_ON_LEAVE]: 'All eligible employees on leave / unavailable',
  [SURPLUS_REASONS.NO_WORKING_DAYS]: 'No effective working days configured for week',
  [SURPLUS_REASONS.ROLE_NOT_CONFIGURED]: 'Role not configured in system',
  [SURPLUS_REASONS.CAPACITY_RULE_MISSING]: 'Capacity rule missing for content type and role',
};

export const DEFAULT_CAPACITY_RULES = [
  // Graphic Designer Rules
  {
    role: ROLES.GRAPHIC_DESIGNER,
    contentType: CONTENT_TYPES.POST,
    dailyQuantity: 3,
    capacityWeight: 1, // 1 Post = 1 unit
    description: 'Standard social post graphic'
  },
  {
    role: ROLES.GRAPHIC_DESIGNER,
    contentType: CONTENT_TYPES.REEL,
    dailyQuantity: 1,
    capacityWeight: 3, // 1 Reel = 3 Post capacity units
    description: 'Reel cover, frames, thumbnails & graphic assets'
  },
  {
    role: ROLES.GRAPHIC_DESIGNER,
    contentType: CONTENT_TYPES.STORY,
    dailyQuantity: 1,
    capacityWeight: 1, // 1 Story = 1 unit
    description: 'Story slide / layout design'
  },
  // Video Editor Rules
  {
    role: ROLES.VIDEO_EDITOR,
    contentType: CONTENT_TYPES.REEL,
    dailyQuantity: 3,
    capacityWeight: 1, // 1 Reel = 1 unit
    description: 'Video reel cuts, transitions, audio sync'
  },
  {
    role: ROLES.VIDEO_EDITOR,
    contentType: CONTENT_TYPES.STORY,
    dailyQuantity: 1,
    capacityWeight: 1, // 1 Video Story = 1 unit
    description: 'Motion / animated video story'
  },
];

export const EPSILON = 0.0001;

export const UTILIZATION_THRESHOLDS = {
  SAFE: 70,       // < 70%: Green
  MODERATE: 90,   // 70-90%: Amber
  HIGH: 100,      // 90-100%: Red
  OVERLOADED: 100 // > 100%: Overloaded
};

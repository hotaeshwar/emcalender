/**
 * Form and Entity Validators
 */

export function validateClient(data = {}, existingClients = [], editingId = null) {
  const errors = {};

  if (!data.name || !data.name.trim()) {
    errors.name = 'Client Name is required.';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Client Name must be at least 2 characters.';
  }

  if (data.clientCode && data.clientCode.trim().length > 15) {
    errors.clientCode = 'Client Code cannot exceed 15 characters.';
  }

  // Unique Client Code Check
  if (data.clientCode && data.clientCode.trim()) {
    const targetCode = data.clientCode.trim().toUpperCase();
    const duplicate = existingClients.find((c) => {
      const existingCode = (c.clientCode || '').trim().toUpperCase();
      const isDifferent = editingId ? c.id !== editingId : true;
      return isDifferent && existingCode === targetCode;
    });

    if (duplicate) {
      errors.clientCode = `Client Code "${targetCode}" is already in use by ${duplicate.name}. Please enter a unique code.`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateEmployee(data = {}) {
  const errors = {};
  if (!data.name || !data.name.trim()) {
    errors.name = 'Employee Name is required.';
  }

  if (!data.employeeCode || !data.employeeCode.trim()) {
    errors.employeeCode = 'Employee Code is required (e.g. EMP001).';
  }

  if (!data.role) {
    errors.role = 'Employee Role is required.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCapacityRule(data = {}) {
  const errors = {};
  if (!data.role) {
    errors.role = 'Role is required.';
  }
  if (!data.contentType) {
    errors.contentType = 'Content Type is required.';
  }
  if (data.dailyQuantity === undefined || data.dailyQuantity === '' || Number(data.dailyQuantity) <= 0) {
    errors.dailyQuantity = 'Daily quantity must be greater than 0.';
  }
  if (data.capacityWeight === undefined || data.capacityWeight === '' || Number(data.capacityWeight) <= 0) {
    errors.capacityWeight = 'Capacity weight must be greater than 0.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateWorkWeek(data = {}) {
  const errors = {};
  if (!data.name || !data.name.trim()) {
    errors.name = 'Week Name is required.';
  }
  if (!data.startDate) {
    errors.startDate = 'Start Date is required.';
  }
  if (!data.endDate) {
    errors.endDate = 'End Date is required.';
  }
  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    errors.endDate = 'End Date must be on or after Start Date.';
  }
  if (!Array.isArray(data.workingDates) || data.workingDates.length === 0) {
    errors.workingDates = 'Please select at least 1 working date.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateWorkRequirement(data = {}) {
  const errors = {};
  if (!data.clientId) {
    errors.clientId = 'Please select a Client.';
  }
  if (!data.weekId) {
    errors.weekId = 'Please select a Work Week.';
  }

  const reqs = data.requirements || {};
  const posts = Number(reqs.posts !== undefined ? reqs.posts : data.posts) || 0;
  const reels = Number(reqs.reels !== undefined ? reqs.reels : data.reels) || 0;
  const stories = Number(reqs.stories !== undefined ? reqs.stories : data.stories) || 0;

  if (posts < 0) errors.posts = 'Posts cannot be negative.';
  if (reels < 0) errors.reels = 'Reels cannot be negative.';
  if (stories < 0) errors.stories = 'Stories cannot be negative.';

  if (posts === 0 && reels === 0 && stories === 0) {
    errors.general = 'Please enter at least one quantity for Posts, Reels, or Stories.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAvailability(data = {}) {
  const errors = {};
  if (!data.employeeId) errors.employeeId = 'Employee is required.';
  if (!data.date) errors.date = 'Date is required.';
  if (!data.availability) errors.availability = 'Availability status is required.';

  if (data.availability === 'custom') {
    if (data.customCapacityUnits === undefined || Number(data.customCapacityUnits) < 0) {
      errors.customCapacityUnits = 'Custom capacity units must be >= 0.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

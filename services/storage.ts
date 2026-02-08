import { supabase } from '../supabaseClient';
import { Appointment, ServiceType, Announcement, AnnouncementHistoryItem } from '../types';
import { OPENING_HOUR, CLOSING_HOUR } from '../constants';

const EVENT_KEY = 'cortefacil_db_update';

// Helper to broadcast changes
const notifyListeners = () => {
  window.dispatchEvent(new Event(EVENT_KEY));
};

// --- APPOINTMENTS ---

export const getAppointments = async (): Promise<Appointment[]> => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*');

  if (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }

  // Map snake_case DB columns to camelCase types if necessary
  // Supabase returns fields matching column names. 
  // We need to map them to our Appointment interface.
  return data.map((item: any) => ({
    id: item.id,
    customerName: item.customer_name,
    customerPhone: item.customer_phone,
    serviceId: item.service_id as ServiceType,
    date: item.date,
    time: item.time,
    status: item.status,
    createdAt: new Date(item.created_at).getTime()
  }));
};

export const saveAppointment = async (appointment: Omit<Appointment, 'id' | 'createdAt' | 'status'>): Promise<void> => {
  const { error } = await supabase
    .from('appointments')
    .insert([{
      customer_name: appointment.customerName,
      customer_phone: appointment.customerPhone,
      service_id: appointment.serviceId,
      date: appointment.date,
      time: appointment.time,
      status: 'confirmed' // Auto confirm for MVP
    }]);

  if (error) console.error('Error saving appointment:', error);
  notifyListeners();
};

export const updateAppointmentStatus = async (id: string, status: Appointment['status']): Promise<void> => {
  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id);

  if (error) console.error('Error updating status:', error);
  notifyListeners();
};

export const getAvailableSlots = async (date: string): Promise<string[]> => {
  // 1. Validation: Check if it is Sunday
  // We append T12:00:00 to ensure we check the day in the middle of the day 
  // to avoid timezone offsets shifting the date to the previous day.
  const dateObj = new Date(date + 'T12:00:00');
  if (dateObj.getDay() === 0) {
    return []; // Closed on Sundays
  }

  // Fetch appointments only for this date to save bandwidth
  const { data, error } = await supabase
    .from('appointments')
    .select('time, status')
    .eq('date', date);

  if (error) {
    console.error('Error fetching slots:', error);
    return [];
  }

  const takenTimes = data
    .filter((app: any) => app.status !== 'cancelled')
    .map((app: any) => app.time);

  const slots: string[] = [];
  
  // 2. Validation: Check if date is today to filter past hours
  const now = new Date();
  // Construct "YYYY-MM-DD" for local time
  const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const isToday = date === todayStr;
  const currentHour = now.getHours();

  for (let hour = OPENING_HOUR; hour < CLOSING_HOUR; hour++) {
    // If it's today, skip hours that have already passed or are the current hour (assuming 1h notice)
    if (isToday && hour <= currentHour) {
      continue;
    }

    const timeString = `${hour.toString().padStart(2, '0')}:00`;
    if (!takenTimes.includes(timeString)) {
      slots.push(timeString);
    }
  }

  return slots;
};

// --- ANNOUNCEMENTS ---

export const getAnnouncement = async (): Promise<Announcement> => {
  // Get the most recently activated active announcement
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('last_active_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return { message: '', isActive: false, type: 'info' };
  }

  return {
    message: data.message,
    isActive: data.is_active,
    type: data.type as 'info' | 'alert' | 'success'
  };
};

export const getAnnouncementHistory = async (): Promise<AnnouncementHistoryItem[]> => {
  const EXPIRATION_HOURS = 72;
  const dateThreshold = new Date();
  dateThreshold.setHours(dateThreshold.getHours() - EXPIRATION_HOURS);

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', false)
    .gt('last_active_at', dateThreshold.toISOString())
    .order('last_active_at', { ascending: false });

  if (error) {
    console.error('Error fetching history:', error);
    return [];
  }

  return data.map((item: any) => ({
    id: item.id,
    message: item.message,
    type: item.type as 'info' | 'alert' | 'success',
    lastActiveAt: new Date(item.last_active_at).getTime()
  }));
};

export const saveAnnouncement = async (announcement: Announcement): Promise<void> => {
  if (announcement.isActive) {
    // 1. Deactivate all existing active announcements first (ensure only 1 is active)
    await supabase
      .from('announcements')
      .update({ is_active: false })
      .eq('is_active', true);

    // 2. Insert new active announcement
    await supabase
      .from('announcements')
      .insert([{
        message: announcement.message,
        type: announcement.type,
        is_active: true,
        last_active_at: new Date().toISOString()
      }]);
  } else {
    // If we are turning it off, we need to find the currently active one and turn it off
    // However, the UI passes the state. 
    // Simplest way for this specific UI flow: Deactivate EVERYTHING.
    await supabase
      .from('announcements')
      .update({ is_active: false })
      .eq('is_active', true);
  }

  notifyListeners();
};

export const subscribeToChanges = (callback: () => void) => {
  window.addEventListener(EVENT_KEY, callback);
  return () => window.removeEventListener(EVENT_KEY, callback);
};

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { AppointmentSearchParams, appointmentService } from '../../services/appointmentService';
import { Appointment, CreateAppointmentRequest, UpdateAppointmentRequest } from '../../types';

// ✅ Interface for state
export interface AppointmentState {
  appointments: Appointment[];
  currentAppointment: Appointment | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  } | null;
  isCancelling: boolean;
  cancelError: string | null;
  pendingAppointment: CreateAppointmentRequest | null;
  // ✅ Add noShowStatus for no-show feature
  noShowStatus: {
    noShowCount: number;
    restricted: boolean;
    isLoading: boolean;
    error: string | null;
  };
}

const initialState: AppointmentState = {
  appointments: [],
  currentAppointment: null,
  isLoading: false,
  error: null,
  pagination: null,
  isCancelling: false,
  cancelError: null,
  pendingAppointment: null,
  // ✅ Initialize noShowStatus
  noShowStatus: {
    noShowCount: 0,
    restricted: false,
    isLoading: false,
    error: null,
  },
};

// ✅ Async Thunks
export const createAppointment = createAsyncThunk(
  'appointments/create',
  async (data: CreateAppointmentRequest, { rejectWithValue }) => {
    try {
      const response = await appointmentService.createAppointment(data);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Không thể tạo lịch hẹn';
      return rejectWithValue(message);
    }
  }
);

export const getUserAppointments = createAsyncThunk(
  'appointments/getUserAppointments',
  async (params: AppointmentSearchParams = {}, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getUserAppointments(params);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Không thể tải danh sách lịch hẹn';
      return rejectWithValue(message);
    }
  }
);

export const getAppointmentById = createAsyncThunk(
  'appointments/getById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getAppointmentById(id);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Không thể tải chi tiết lịch hẹn';
      return rejectWithValue(message);
    }
  }
);

export const updateAppointment = createAsyncThunk(
  'appointments/update',
  async (payload: { id: string; data: UpdateAppointmentRequest }, { rejectWithValue }) => {
    try {
      console.log('🔄 Redux: Updating appointment:', payload);
      const response = await appointmentService.updateAppointment(payload.id, payload.data);
      console.log('✅ Redux: Appointment updated successfully:', response.data);
      return { id: payload.id, appointment: response.data };
    } catch (error: any) {
      console.error('❌ Redux: Update appointment error:', error);
      const message = error.response?.data?.message || error.message || 'Không thể cập nhật lịch hẹn';
      return rejectWithValue(message);
    }
  }
);

export const cancelAppointment = createAsyncThunk(
  'appointments/cancel',
  async (id: string, { rejectWithValue }) => {
    try {
      console.log('🔄 Redux: Starting cancel appointment:', id);
      const response = await appointmentService.cancelAppointment(id);
      console.log('✅ Redux: Cancel appointment success:', response.data);
      return { id, appointment: response.data };
    } catch (error: any) {
      console.error('❌ Redux: Cancel appointment error:', error);
      let message = 'Không thể hủy lịch hẹn';
      if (typeof error === 'string') {
        message = error;
      } else if (error?.message) {
        message = error.message;
      } else if (error?.response?.data?.message) {
        message = error.response.data.message;
      }
      console.error('❌ Redux: Cancel error message:', message);
      return rejectWithValue(message);
    }
  }
);

export const getAvailableSlots = createAsyncThunk(
  'appointments/getAvailableSlots',
  async (date: string, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getAvailableSlots(date);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Không thể tải khung giờ trống';
      return rejectWithValue(message);
    }
  }
);

// ✅ Add getNoShowStatus async thunk
export const getNoShowStatus = createAsyncThunk(
  'appointments/getNoShowStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getNoShowStatus();
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Không thể tải trạng thái no-show';
      return rejectWithValue(message);
    }
  }
);

const appointmentSlice = createSlice({
  name: 'appointments',
  initialState,
  reducers: {
    // ✅ Existing reducers
    clearError: (state) => {
      state.error = null;
      state.cancelError = null;
      state.noShowStatus.error = null; // ✅ Clear noShowStatus error
    },
    clearCurrentAppointment: (state) => {
      state.currentAppointment = null;
    },
    resetState: () => initialState,
    savePendingAppointment: (state, action) => {
      state.pendingAppointment = action.payload;
    },
    clearPendingAppointment: (state) => {
      state.pendingAppointment = null;
    },
  },
  extraReducers: (builder) => {
    // Create appointment
    builder
      .addCase(createAppointment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createAppointment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.appointments.unshift(action.payload);
        state.pendingAppointment = null;
      })
      .addCase(createAppointment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Get user appointments
    builder
      .addCase(getUserAppointments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getUserAppointments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.appointments = action.payload.appointments;
        state.pagination = action.payload.pagination;
      })
      .addCase(getUserAppointments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Get appointment by ID
    builder
      .addCase(getAppointmentById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAppointmentById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentAppointment = action.payload;
      })
      .addCase(getAppointmentById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Update appointment
    builder
      .addCase(updateAppointment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateAppointment.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.appointments.findIndex((apt) => apt._id === action.payload.id);
        if (index !== -1) {
          state.appointments[index] = action.payload.appointment;
        }
        if (state.currentAppointment && state.currentAppointment._id === action.payload.id) {
          state.currentAppointment = action.payload.appointment;
        }
      })
      .addCase(updateAppointment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Cancel appointment
    builder
      .addCase(cancelAppointment.pending, (state) => {
        state.isCancelling = true;
        state.cancelError = null;
        console.log('🔄 Redux: Cancel appointment pending');
      })
      .addCase(cancelAppointment.fulfilled, (state, action) => {
        state.isCancelling = false;
        const { id, appointment } = action.payload;
        console.log('✅ Redux: Cancel appointment fulfilled:', { id, status: appointment.status });
        const index = state.appointments.findIndex((apt) => apt._id === id);
        if (index !== -1) {
          state.appointments[index] = appointment;
          console.log('✅ Redux: Updated appointment in list');
        }
        if (state.currentAppointment && state.currentAppointment._id === id) {
          state.currentAppointment = appointment;
          console.log('✅ Redux: Updated current appointment');
        }
      })
      .addCase(cancelAppointment.rejected, (state, action) => {
        state.isCancelling = false;
        state.cancelError = action.payload as string;
        console.error('❌ Redux: Cancel appointment rejected:', action.payload);
      });

    // Get available slots
    builder
      .addCase(getAvailableSlots.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAvailableSlots.fulfilled, (state, action) => {
        state.isLoading = false;
        state.availableSlots = action.payload; // ✅ Add availableSlots to state
      })
      .addCase(getAvailableSlots.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // ✅ Handle getNoShowStatus
    builder
      .addCase(getNoShowStatus.pending, (state) => {
        state.noShowStatus.isLoading = true;
        state.noShowStatus.error = null;
      })
      .addCase(getNoShowStatus.fulfilled, (state, action) => {
        state.noShowStatus.isLoading = false;
        state.noShowStatus.noShowCount = action.payload.noShowCount;
        state.noShowStatus.restricted = action.payload.restricted;
      })
      .addCase(getNoShowStatus.rejected, (state, action) => {
        state.noShowStatus.isLoading = false;
        state.noShowStatus.error = action.payload as string;
      });
  },
});

// ✅ Export actions
export const { clearError, clearCurrentAppointment, resetState, savePendingAppointment, clearPendingAppointment } = appointmentSlice.actions;

// ✅ Export reducer
export default appointmentSlice.reducer;

// ✅ Selectors
export const selectAppointments = (state: { appointments: AppointmentState }) => state.appointments.appointments;
export const selectCurrentAppointment = (state: { appointments: AppointmentState }) => state.appointments.currentAppointment;
export const selectAppointmentLoading = (state: { appointments: AppointmentState }) => state.appointments.isLoading;
export const selectAppointmentError = (state: { appointments: AppointmentState }) => state.appointments.error;
export const selectAppointmentPagination = (state: { appointments: AppointmentState }) => state.appointments.pagination;
export const selectIsCancelling = (state: { appointments: AppointmentState }) => state.appointments.isCancelling;
export const selectCancelError = (state: { appointments: AppointmentState }) => state.appointments.cancelError;
export const selectPendingAppointment = (state: { appointments: AppointmentState }) => state.appointments.pendingAppointment;
export const selectNoShowStatus = (state: { appointments: AppointmentState }) => state.appointments.noShowStatus;
export const selectAvailableSlots = (state: { appointments: AppointmentState }) => state.appointments.availableSlots; // ✅ Add selectAvailableSlots

// Helper selectors
export const selectAppointmentsByStatus = (status: string) => (state: { appointments: AppointmentState }) =>
  state.appointments.appointments.filter((apt) => status === 'all' || apt.status === status);

export const selectUpcomingAppointments = (state: { appointments: AppointmentState }) =>
  state.appointments.appointments.filter((apt) => {
    const appointmentDateTime = new Date(`${apt.appointment_date}T${apt.appointment_time}`);
    return appointmentDateTime > new Date() && apt.status !== 'cancelled';
  });

export const selectCancellableAppointments = (state: { appointments: AppointmentState }) =>
  state.appointments.appointments.filter((apt) => {
    const appointmentDateTime = new Date(`${apt.appointment_date}T${apt.appointment_time}`);
    return apt.status === 'pending' && appointmentDateTime > new Date();
  });
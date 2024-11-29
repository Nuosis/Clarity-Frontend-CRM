import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentStaffId: null
};

export const staffSlice = createSlice({
  name: 'staff',
  initialState,
  reducers: {
    setCurrentStaffId: (state, action) => {
      state.currentStaffId = action.payload;
    }
  }
});

export const { setCurrentStaffId } = staffSlice.actions;

export default staffSlice.reducer;

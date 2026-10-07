import '@testing-library/jest-dom';
import { useFirebaseAuth } from '@/providers/firebase-auth-provider';
import {
  recordAchievement,
  resetTarget,
  saveReminderSettings,
  subscribeHistory,
  subscribeReminderSettings,
  subscribeTarget
} from '@/services/firebase/target.service';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TargetTracker } from '@/components/target/target-tracker';

jest.mock('@/providers/firebase-auth-provider', () => ({
  useFirebaseAuth: jest.fn()
}));

jest.mock('@/services/firebase/target.service', () => ({
  createTarget: jest.fn(),
  recordAchievement: jest.fn(),
  resetTarget: jest.fn(),
  saveReminderSettings: jest.fn(),
  subscribeHistory: jest.fn(),
  subscribeReminderSettings: jest.fn(),
  subscribeTarget: jest.fn(),
  DEFAULT_REMINDER_SETTINGS: {
    enabled: false,
    timezone: 'Asia/Ho_Chi_Minh',
    times: ['09:00']
  }
}));

const useFirebaseAuthMock = jest.mocked(useFirebaseAuth);
const subscribeTargetMock = jest.mocked(subscribeTarget);
const subscribeHistoryMock = jest.mocked(subscribeHistory);
const subscribeReminderSettingsMock = jest.mocked(subscribeReminderSettings);
const recordAchievementMock = jest.mocked(recordAchievement);
const resetTargetMock = jest.mocked(resetTarget);
const saveReminderSettingsMock = jest.mocked(saveReminderSettings);

describe('target tracker', () => {
  beforeEach(() => {
    useFirebaseAuthMock.mockReturnValue({
      user: { uid: 'private-browser-user' } as never,
      loading: false,
      configured: true,
      error: null
    });
    subscribeTargetMock.mockImplementation((_uid, onValue) => {
      onValue({
        label: 'Đọc sách',
        unit: 'trang',
        targetUnits: 100,
        remainingUnits: 64,
        createdAt: {} as never,
        updatedAt: {} as never,
        lastEventId: null
      });

      return () => undefined;
    });
    subscribeHistoryMock.mockImplementation((_uid, _generation, onValue) => {
      onValue([]);

      return () => undefined;
    });
    subscribeReminderSettingsMock.mockImplementation((_uid, onValue) => {
      onValue(null);

      return () => undefined;
    });
    recordAchievementMock.mockResolvedValue('event-id');
    resetTargetMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('shows the persisted target summary and records a valid achievement', async () => {
    const user = userEvent.setup();
    render(<TargetTracker />);

    expect(await screen.findByRole('heading', { name: 'Đọc sách' })).toBeInTheDocument();
    expect(screen.getByText('64')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Số vừa đạt (trang)'), '5');
    await user.type(screen.getByLabelText('Lý do / ghi chú'), 'Đọc trong giờ nghỉ');
    await user.click(screen.getByRole('button', { name: 'Ghi nhận tiến độ' }));

    await waitFor(() =>
      expect(recordAchievementMock).toHaveBeenCalledWith(
        'private-browser-user',
        expect.objectContaining({ amountUnits: 5, reason: 'Đọc trong giờ nghỉ' })
      )
    );
  });

  it('allows reminder times and timezone to be edited', async () => {
    const user = userEvent.setup();
    render(<TargetTracker />);

    await screen.findByRole('heading', { name: 'Đọc sách' });
    fireEvent.click(screen.getByLabelText('Bật'));
    fireEvent.change(screen.getByLabelText('Múi giờ'), { target: { value: 'Asia/Ho_Chi_Minh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm giờ' }));
    fireEvent.change(screen.getByLabelText('Giờ nhắc 2'), { target: { value: '20:30' } });
    await user.click(screen.getByRole('button', { name: 'Lưu lịch nhắc' }));

    expect(saveReminderSettingsMock).toHaveBeenCalledWith('private-browser-user', {
      enabled: true,
      timezone: 'Asia/Ho_Chi_Minh',
      times: ['09:00', '20:30']
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu lịch nhắc');
  });

  it('shows the setup-again action even when the target has no progress', async () => {
    subscribeTargetMock.mockImplementation((_uid, onValue) => {
      onValue({
        label: 'Đọc sách',
        unit: 'trang',
        targetUnits: 100,
        remainingUnits: 100,
        createdAt: {} as never,
        updatedAt: {} as never,
        lastEventId: null
      });

      return () => undefined;
    });
    const user = userEvent.setup();
    render(<TargetTracker />);

    await user.click(await screen.findByRole('button', { name: 'Thiết lập lại target' }));

    expect(
      await screen.findByRole('heading', { name: 'Thiết lập lại mục tiêu' })
    ).toBeInTheDocument();
  });

  it('opens a modal for visitors to reconfigure the shared target and clear history', async () => {
    const user = userEvent.setup();
    render(<TargetTracker />);

    await user.click(await screen.findByRole('button', { name: 'Thiết lập lại target' }));
    expect(
      await screen.findByRole('dialog', { name: 'Thiết lập lại mục tiêu' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Tên mục tiêu')).toHaveValue('Đọc sách');
    expect(screen.getByLabelText('Con số cần đạt')).toHaveValue(100);
    expect(screen.getByLabelText('Đơn vị')).toHaveValue('trang');
    expect(screen.getByText(/Toàn bộ lịch sử tiến độ sẽ bị xóa/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Con số cần đạt'));
    await user.type(screen.getByLabelText('Con số cần đạt'), '80');
    await user.click(screen.getByRole('button', { name: 'Đồng ý, thiết lập lại' }));

    await waitFor(() =>
      expect(resetTargetMock).toHaveBeenCalledWith('private-browser-user', {
        label: 'Đọc sách',
        unit: 'trang',
        targetUnits: 80
      })
    );
  });

  it('leaves the target untouched when the setup modal is cancelled', async () => {
    const user = userEvent.setup();
    render(<TargetTracker />);

    await user.click(await screen.findByRole('button', { name: 'Thiết lập lại target' }));
    await user.click(screen.getByRole('button', { name: 'Hủy' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(resetTargetMock).not.toHaveBeenCalled();
  });
});

// app/screens/AppointmentHistoryScreen.tsx - TÍCH HỢP ĐẦY ĐỦ CHỨC NĂNG SỬA, HỦY VÀ NO-SHOW
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { addHours, format, isAfter, parseISO, setHours, setMinutes } from 'date-fns';
import { vi } from 'date-fns/locale';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../../hooks/redux';
import EditAppointmentModal from '../components/Appointment/EditAppointmentModal';
import LoginRequired from '../components/LoginRequired';
import { cancelAppointment, getUserAppointments } from '../redux/slices/appointmentSlice';
import { AppDispatch, RootState } from '../redux/store';
import { Appointment } from '../types';

const AppointmentHistoryScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const dispatch = useDispatch<AppDispatch>();
    const { token } = useAuth();

    // Redux state
    const { appointments, isLoading, error, pagination } = useSelector((state: RootState) => state.appointments);

    // Local state
    const [refreshing, setRefreshing] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    // State cho modal sửa lịch hẹn
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

    // Load appointments when screen is focused
    useFocusEffect(
        useCallback(() => {
            if (token) {
                loadAppointments();
            }
        }, [token, selectedStatus])
    );

    const loadAppointments = async () => {
        try {
            const params = selectedStatus !== 'all' ? { status: selectedStatus as any } : {};
            await dispatch(getUserAppointments(params)).unwrap();
        } catch (error) {
            console.error('Error loading appointments:', error);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAppointments();
        setRefreshing(false);
    };

    // Chức năng sửa lịch hẹn
    const handleEditAppointment = (appointment: Appointment) => {
        const canEdit = canEditAppointment(appointment);

        if (!canEdit.allowed) {
            Alert.alert(
                'Không thể sửa lịch hẹn',
                canEdit.message,
                [{ text: 'Đóng', style: 'default' }]
            );
            return;
        }

        setSelectedAppointment(appointment);
        setIsEditModalVisible(true);
    };

    // Logic kiểm tra có thể sửa lịch hẹn
    const canEditAppointment = (appointment: Appointment) => {
        // Chỉ cho phép sửa khi status là 'pending'
        if (appointment.status !== 'pending') {
            let message = '';
            switch (appointment.status) {
                case 'confirmed':
                    message = 'Lịch hẹn đã được xác nhận và không thể sửa. Vui lòng liên hệ phòng khám nếu cần thay đổi.';
                    break;
                case 'in_progress':
                    message = 'Lịch hẹn đang được thực hiện và không thể sửa.';
                    break;
                case 'completed':
                    message = 'Lịch hẹn đã hoàn thành và không thể sửa.';
                    break;
                case 'cancelled':
                    message = 'Lịch hẹn đã được hủy và không thể sửa.';
                    break;
                case 'no-show':
                    message = 'Lịch hẹn đã được đánh dấu là khách không đến và không thể sửa.';
                    break;
                default:
                    message = 'Không thể sửa lịch hẹn ở trạng thái hiện tại.';
            }
            return { allowed: false, message };
        }

        try {
            const appointmentDate = parseISO(appointment.appointment_date);
            const [hours, minutes] = appointment.appointment_time.split(':').map(Number);
            const appointmentDateTime = setMinutes(setHours(appointmentDate, hours), minutes);
            const appointmentDateTimeLocal = addHours(appointmentDateTime, 7);
            const now = new Date();

            if (!isAfter(appointmentDateTimeLocal, now)) {
                return {
                    allowed: false,
                    message: 'Không thể sửa lịch hẹn đã qua thời gian đặt lịch.'
                };
            }

            return { allowed: true, message: '' };
        } catch (error) {
            console.error('Error in canEditAppointment:', error);
            return {
                allowed: false,
                message: 'Lỗi xử lý thời gian. Vui lòng thử lại.'
            };
        }
    };

    // Chức năng hủy lịch
    const handleCancelAppointment = (appointment: Appointment) => {
        const canCancel = canCancelAppointment(appointment);

        if (!canCancel.allowed) {
            Alert.alert(
                'Không thể hủy lịch hẹn',
                canCancel.message,
                [
                    { text: 'Đóng', style: 'default' },
                    {
                        text: 'Liên hệ hỗ trợ',
                        onPress: () => {
                            Alert.alert(
                                'Liên hệ hỗ trợ',
                                'Vui lòng gọi hotline: 1900 123 456 hoặc email: support@petcare.com để được hỗ trợ hủy lịch hẹn.',
                                [{ text: 'Đã hiểu', style: 'default' }]
                            );
                        }
                    }
                ]
            );
            return;
        }

        Alert.alert(
            'Xác nhận hủy lịch hẹn',
            `Bạn có chắc chắn muốn hủy lịch hẹn dịch vụ "${appointment.service_id.name}" cho ${appointment.pet_id.name}?\n\n` +
            `Thời gian: ${formatDate(appointment.appointment_date)} - ${appointment.appointment_time}\n\n` +
            (canCancel.isLateCancel ? '⚠️ Lưu ý: Bạn đang hủy lịch trong thời gian gần (dưới 2 giờ).' : ''),
            [
                { text: 'Không hủy', style: 'cancel' },
                {
                    text: 'Xác nhận hủy',
                    style: 'destructive',
                    onPress: () => performCancelAppointment(appointment),
                },
            ]
        );
    };

    const performCancelAppointment = async (appointment: Appointment) => {
        setCancellingId(appointment._id);

        try {
            await dispatch(cancelAppointment(appointment._id)).unwrap();

            Alert.alert(
                'Thành công',
                'Đã hủy lịch hẹn thành công',
                [{ text: 'OK', style: 'default' }]
            );

            loadAppointments();

        } catch (error: any) {
            console.error('Cancel appointment error:', error);

            let errorMessage = 'Không thể hủy lịch hẹn. Vui lòng thử lại.';

            if (typeof error === 'string') {
                errorMessage = error;
            } else if (error?.message) {
                errorMessage = error.message;
            }

            Alert.alert(
                'Lỗi hủy lịch hẹn',
                errorMessage,
                [
                    { text: 'Thử lại', onPress: () => performCancelAppointment(appointment) },
                    { text: 'Đóng', style: 'cancel' }
                ]
            );
        } finally {
            setCancellingId(null);
        }
    };

    // Logic kiểm tra có thể hủy lịch
    const canCancelAppointment = (appointment: Appointment) => {
        // Chỉ cho phép hủy khi status là 'pending'
        if (appointment.status !== 'pending') {
            let message = '';
            switch (appointment.status) {
                case 'confirmed':
                    message = 'Lịch hẹn đã được xác nhận và không thể hủy trực tiếp. Vui lòng liên hệ phòng khám để được hỗ trợ.';
                    break;
                case 'in_progress':
                    message = 'Lịch hẹn đang được thực hiện và không thể hủy.';
                    break;
                case 'completed':
                    message = 'Lịch hẹn đã hoàn thành và không thể hủy.';
                    break;
                case 'cancelled':
                    message = 'Lịch hẹn đã được hủy trước đó.';
                    break;
                case 'no-show':
                    message = 'Lịch hẹn đã được đánh dấu là khách không đến.';
                    break;
                default:
                    message = 'Không thể hủy lịch hẹn ở trạng thái hiện tại.';
            }
            return { allowed: false, message };
        }

        try {
            const appointmentDate = parseISO(appointment.appointment_date);
            const [hours, minutes] = appointment.appointment_time.split(':').map(Number);
            const appointmentDateTime = setMinutes(setHours(appointmentDate, hours), minutes);
            const appointmentDateTimeLocal = addHours(appointmentDateTime, 7);
            const now = new Date();

            if (!isAfter(appointmentDateTimeLocal, now)) {
                return {
                    allowed: false,
                    message: 'Không thể hủy lịch hẹn đã qua thời gian đặt lịch.'
                };
            }

            const twoHoursFromNow = addHours(now, 2);
            const isLateCancel = !isAfter(appointmentDateTimeLocal, twoHoursFromNow);

            return {
                allowed: true,
                message: '',
                isLateCancel
            };
        } catch (error) {
            console.error('Error in canCancelAppointment:', error);
            return {
                allowed: false,
                message: 'Lỗi xử lý thời gian. Vui lòng thử lại.',
            };
        }
    };

    // ✅ CẬP NHẬT: Thêm màu cho no-show
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return '#F59E0B'; // Amber
            case 'confirmed':
                return '#3B82F6'; // Blue
            case 'in_progress':
                return '#8B5CF6'; // Purple
            case 'completed':
                return '#10B981'; // Green
            case 'cancelled':
                return '#EF4444'; // Red
            case 'no-show':
                return '#6B7280'; // Gray
            default:
                return '#6B7280';
        }
    };

    // ✅ CẬP NHẬT: Thêm text cho no-show
    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending':
                return 'Chờ xác nhận';
            case 'confirmed':
                return 'Đã xác nhận';
            case 'in_progress':
                return 'Đang thực hiện';
            case 'completed':
                return 'Hoàn thành';
            case 'cancelled':
                return 'Đã hủy';
            case 'no-show':
                return 'Khách không đến';
            default:
                return status;
        }
    };

    // ✅ THÊM: Hàm lấy icon cho status
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return 'time-outline';
            case 'confirmed':
                return 'checkmark-circle-outline';
            case 'in_progress':
                return 'play-circle-outline';
            case 'completed':
                return 'checkmark-done-outline';
            case 'cancelled':
                return 'close-circle-outline';
            case 'no-show':
                return 'person-remove-outline';
            default:
                return 'ellipse-outline';
        }
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(price);
    };

    const formatDate = (dateString: string) => {
        try {
            const date = parseISO(dateString);
            return format(date, 'EEEE, dd/MM/yyyy', { locale: vi });
        } catch (error) {
            const date = new Date(dateString);
            return date.toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }
    };

    const getPetImage = (appointment: Appointment) => {
        const images = appointment.pet_id.images;
        if (images && images.length > 0) {
            const primaryImage = images.find(img => img.is_primary) || images[0];
            return primaryImage.url;
        }
        return 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=100&h=100&fit=crop&crop=face';
    };

    // ✅ CẬP NHẬT: Thêm filter cho no-show
    const renderStatusFilter = () => {
        const statuses = [
            { key: 'all', label: 'Tất cả', color: '#6B7280', icon: 'grid-outline' },
            { key: 'pending', label: 'Chờ xác nhận', color: '#F59E0B', icon: 'time-outline' },
            { key: 'confirmed', label: 'Đã xác nhận', color: '#3B82F6', icon: 'checkmark-circle-outline' },
            { key: 'in_progress', label: 'Đang thực hiện', color: '#8B5CF6', icon: 'play-circle-outline' },
            { key: 'completed', label: 'Hoàn thành', color: '#10B981', icon: 'checkmark-done-outline' },
            { key: 'cancelled', label: 'Đã hủy', color: '#EF4444', icon: 'close-circle-outline' },
            { key: 'no-show', label: 'Không đến', color: '#6B7280', icon: 'person-remove-outline' },
        ];

        return (
            <View style={styles.filterContainer}>
                <FlatList
                    data={statuses}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.key}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[
                                styles.filterItem,
                                selectedStatus === item.key && { backgroundColor: item.color }
                            ]}
                            onPress={() => setSelectedStatus(item.key)}
                        >
                            <View style={styles.filterContent}>
                                <Ionicons
                                    name={item.icon as any}
                                    size={16}
                                    color={selectedStatus === item.key ? '#FFFFFF' : '#6B7280'}
                                />
                                <Text
                                    style={[
                                        styles.filterText,
                                        selectedStatus === item.key && styles.filterTextActive
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            </View>
        );
    };

    const renderAppointmentItem = ({ item }: { item: Appointment }) => {
        const canCancel = canCancelAppointment(item);
        const canEdit = canEditAppointment(item);
        let isUpcoming = false;

        try {
            const appointmentDate = parseISO(item.appointment_date);
            const [hours, minutes] = item.appointment_time.split(':').map(Number);
            const appointmentDateTime = setMinutes(setHours(appointmentDate, hours), minutes);
            const appointmentDateTimeLocal = addHours(appointmentDateTime, 7);

            isUpcoming = isAfter(appointmentDateTimeLocal, new Date());

            
        } catch (error) {
            console.error('Error parsing date:', error, {
                date: item.appointment_date,
                time: item.appointment_time,
            });
        }

        const isCancelling = cancellingId === item._id;

        return (
            <View style={styles.appointmentCard}>
                {/* Header */}
                <View style={styles.appointmentHeader}>
                    <View style={styles.appointmentIdContainer}>
                        <Text style={styles.appointmentId}>#{item._id.slice(-6)}</Text>
                        <View style={[
                            styles.statusBadge,
                            { backgroundColor: `${getStatusColor(item.status)}20` }
                        ]}>
                            <Ionicons
                                name={getStatusIcon(item.status) as any}
                                size={14}
                                color={getStatusColor(item.status)}
                            />
                            <Text style={[
                                styles.statusText,
                                { color: getStatusColor(item.status) }
                            ]}>
                                {getStatusText(item.status)}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.appointmentDate}>
                        {format(parseISO(item.created_at), 'dd/MM/yyyy', { locale: vi })}
                    </Text>
                </View>

                {/* Content */}
                <View style={styles.appointmentContent}>
                    <Image source={{ uri: getPetImage(item) }} style={styles.petImage} />
                    <View style={styles.appointmentInfo}>
                        <Text style={styles.petName}>{item.pet_id.name}</Text>
                        <Text style={styles.serviceName}>{item.service_id.name}</Text>
                        <View style={styles.appointmentTimeContainer}>
                            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                            <Text style={styles.appointmentTime}>
                                {formatDate(item.appointment_date)} - {item.appointment_time}
                            </Text>
                        </View>
                        <View style={styles.priceContainer}>
                            <Ionicons name="pricetag-outline" size={16} color="#6B7280" />
                            <Text style={styles.price}>{formatPrice(item.total_amount)}</Text>
                        </View>

                        {/* ✅ THÊM: Hiển thị lý do no-show nếu có */}
                        {item.status === 'no-show' && (
                            <View style={styles.noShowInfoContainer}>
                                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                                <Text style={styles.noShowInfo}>
                                    Khách hàng không đến trong giờ hẹn
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Actions */}
                <View style={styles.appointmentActions}>
                    <TouchableOpacity
                        style={styles.detailButton}
                        onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item._id })}
                    >
                        <Text style={styles.detailButtonText}>Chi tiết</Text>
                    </TouchableOpacity>

                    {/* Nút sửa lịch hẹn - chỉ hiện khi pending và có thể sửa */}
                    {item.status === 'pending' && canEdit.allowed && (
                        <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => handleEditAppointment(item)}
                        >
                            <Ionicons name="pencil-outline" size={16} color="#3B82F6" />
                            <Text style={styles.editButtonText}>Sửa</Text>
                        </TouchableOpacity>
                    )}

                    {/* Nút hủy lịch */}
                    {item.status === 'pending' && isUpcoming && (
                        <TouchableOpacity
                            style={[
                                styles.cancelButton,
                                isCancelling && styles.cancelButtonDisabled
                            ]}
                            onPress={() => handleCancelAppointment(item)}
                            disabled={isCancelling}
                        >
                            {isCancelling ? (
                                <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                                <>
                                    <Ionicons name="close-outline" size={16} color="#DC2626" />
                                    <Text style={styles.cancelButtonText}>Hủy lịch</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Nút liên hệ hỗ trợ cho lịch confirmed */}
                    {item.status === 'confirmed' && (
                        <TouchableOpacity
                            style={styles.contactSupportButton}
                            onPress={() => navigation.navigate('CustomerSupport')}

                        >
                            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#D97706" />
                            <Text style={styles.contactSupportButtonText}>Liên hệ hủy</Text>
                        </TouchableOpacity>
                    )}

                    {/* ✅ THÊM: Nút đặt lại cho lịch no-show */}
                    {item.status === 'no-show' && (
                        <TouchableOpacity
                            style={styles.rebookButton}
                            onPress={() => navigation.navigate('PetCareBooking', {
                                rebookData: {
                                    serviceId: item.service_id._id,
                                    petId: item.pet_id._id
                                }
                            })}
                        >
                            <Ionicons name="refresh-outline" size={16} color="#10B981" />
                            <Text style={styles.rebookButtonText}>Đặt lại</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const renderEmptyList = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Chưa có lịch hẹn nào</Text>
            <Text style={styles.emptySubtitle}>
                {selectedStatus === 'all'
                    ? 'Bạn chưa đặt lịch hẹn nào. Hãy đặt lịch chăm sóc cho thú cưng của bạn.'
                    : `Không có lịch hẹn nào với trạng thái "${getStatusText(selectedStatus)}".`
                }
            </Text>
            <TouchableOpacity
                style={styles.bookNowButton}
                onPress={() => navigation.navigate('PetCareBooking')}
            >
                <Text style={styles.bookNowButtonText}>Đặt lịch ngay</Text>
            </TouchableOpacity>
        </View>
    );

    if (!token) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#374151" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Lịch sử đặt lịch</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <LoginRequired
                        title="Cần đăng nhập"
                        description="Vui lòng đăng nhập để xem lịch sử đặt lịch hẹn"
                        primaryLabel="Đăng nhập"
                        onPrimaryPress={() => navigation.navigate('Login')}
                        showCreateAccount={false}
                        showGuestLink={true}
                        onGuestPress={() => navigation.navigate('Home')}
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color="#374151" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Lịch sử đặt lịch</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('PetCareBooking')}
                >
                    <Ionicons name="add" size={24} color="#3B82F6" />
                </TouchableOpacity>
            </View>

            {/* Status Filter */}
            {renderStatusFilter()}

            {/* Appointments List */}
            {isLoading && appointments.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Đang tải lịch hẹn...</Text>
                </View>
            ) : (
                <FlatList
                    data={appointments}
                    renderItem={renderAppointmentItem}
                    keyExtractor={(item) => item._id}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={['#3B82F6']}
                        />
                    }
                    contentContainerStyle={[
                        styles.listContainer,
                        appointments.length === 0 && styles.emptyListContainer
                    ]}
                    ListEmptyComponent={renderEmptyList}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Error Message */}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={loadAppointments}
                    >
                        <Text style={styles.retryButtonText}>Thử lại</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Modal sửa lịch hẹn */}
            <EditAppointmentModal
                visible={isEditModalVisible}
                onClose={() => {
                    setIsEditModalVisible(false);
                    setSelectedAppointment(null);
                }}
                appointment={selectedAppointment}
                onSuccess={() => {
                    loadAppointments();
                }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        marginTop: 20,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#374151',
        flex: 1,
        textAlign: 'center',
    },
    addButton: {
        padding: 8,
    },

    // Filter styles
    filterContainer: {
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterItem: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginLeft: 16,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
    },
    filterContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
        marginLeft: 6,
    },
    filterTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },

    // List styles
    listContainer: {
        padding: 16,
    },
    emptyListContainer: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },

    // Appointment card styles
    appointmentCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    appointmentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    appointmentIdContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    appointmentId: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#374151',
        marginRight: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    appointmentDate: {
        fontSize: 12,
        color: '#6B7280',
    },
    appointmentContent: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    petImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 12,
    },
    appointmentInfo: {
        flex: 1,
    },
    petName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 4,
    },
    serviceName: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    appointmentTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    appointmentTime: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 6,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    price: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3B82F6',
        marginLeft: 6,
    },
    notesContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 4,
    },
    notes: {
        fontSize: 12,
        color: '#6B7280',
        marginLeft: 6,
        flex: 1,
    },

    // ✅ THÊM: Styles cho no-show info
    noShowInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    noShowInfo: {
        fontSize: 12,
        color: '#DC2626',
        marginLeft: 6,
        fontStyle: 'italic',
    },

    // Action buttons
    appointmentActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
    },
    detailButton: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        paddingVertical: 10,
        borderRadius: 8,
        marginRight: 8,
        marginBottom: 8,
        alignItems: 'center',
    },
    detailButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },

    // Edit button
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3B82F6',
        marginLeft: 4,
    },

    // Cancel button
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#DC2626',
        marginLeft: 4,
    },
    cancelButtonDisabled: {
        backgroundColor: '#F3F4F6',
        opacity: 0.6,
    },

    // Contact support button
    contactSupportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    contactSupportButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#D97706',
        marginLeft: 4,
    },

    // ✅ THÊM: Rebook button cho no-show
    rebookButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    rebookButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10B981',
        marginLeft: 4,
    },

    // Empty state styles
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#374151',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    bookNowButton: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    bookNowButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },

    // Error styles
    errorContainer: {
        position: 'absolute',
        bottom: 20,
        left: 16,
        right: 16,
        backgroundColor: '#FEE2E2',
        padding: 16,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    errorText: {
        fontSize: 14,
        color: '#DC2626',
        flex: 1,
    },
    retryButton: {
        backgroundColor: '#DC2626',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 12,
    },
    retryButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default AppointmentHistoryScreen;
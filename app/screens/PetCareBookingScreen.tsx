import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../../hooks/redux';
import { clearPendingAppointment, createAppointment, getAvailableSlots, savePendingAppointment, selectPendingAppointment,selectNoShowStatus,getNoShowStatus } from '../redux/slices/appointmentSlice';
import { getAllServices } from '../redux/slices/careServiceSlice';
import { AppDispatch, RootState } from '../redux/store';
import { ordersService } from '../services/OrderApiService';
import { Pet } from '../types';
import { CustomerInfo, Service, TimeSlot } from '../types/PetCareBooking';
import { API_BASE_URL } from '../utils/api-client';

// ================================
// TYPES & INTERFACES
// ================================

interface PurchasedPetOrderItem {
    _id: string;
    pet_id?: {
        _id: string;
        name: string;
        type: string;
        breed_id: string | { name: string };
        age?: number;
        images?: { url: string }[];
    };
    item_info?: any;
    item_type?: 'pet' | 'product' | 'variant';
    images?: Array<{ url: string; is_primary?: boolean }>;
    quantity: number;
    unit_price: number;
    order_id: any;
    variant_id?: {
        _id: string;
        pet_id: {
            _id: string;
            name: string;
            type?: string;
            breed_id?: string | { name: string };
            age?: number;
            price?: number;
        };
        color: string;
        weight: number;
        gender: string;
        age: number;
        price_adjustment: number;
    };
}

interface ApiOrderItem extends PurchasedPetOrderItem {
    product_id?: {
        _id: string;
        name: string;
        price: number;
    };
}

interface VNPayResponse {
    vnp_ResponseCode?: string;
    vnp_TransactionStatus?: string;
    vnp_TxnRef?: string;
    vnp_PayDate?: string;
    vnp_Amount?: string;
}

// ================================
// HELPER FUNCTIONS
// ================================

const extractPetFromOrderItem = (orderItem: ApiOrderItem): PurchasedPetOrderItem | null => {
    console.log('🔍 Extracting pet from order item:', JSON.stringify(orderItem, null, 2));

    let petData = null;
    let petId = null;

    if (orderItem.item_type) {
        console.log('✅ New format detected with item_type:', orderItem.item_type);

        switch (orderItem.item_type) {
            case 'pet':
                if (orderItem.item_info) {
                    petData = orderItem.item_info;
                    petId = orderItem.item_info._id;
                    console.log('🐕 Direct pet item found:', petId);
                }
                break;

            case 'variant':
                console.log('🧬 Processing variant item...');
                if (orderItem.variant_id?.pet_id) {
                    petData = orderItem.variant_id.pet_id;
                    petId = orderItem.variant_id.pet_id._id;
                    console.log('🧬 Variant pet found in variant_id.pet_id:', petId);
                } else if (orderItem.item_info?.variant?.pet_id) {
                    petData = orderItem.item_info.pet_id;
                    petId = orderItem.item_info.pet_id._id;
                    console.log('🧬 Variant pet found in item_info.pet_id:', petId);
                } else if (orderItem.item_info?._id) {
                    petData = orderItem.item_info;
                    petId = orderItem.item_info._id;
                    console.log('🧬 Variant pet found in item_info:', petId);
                }
                break;

            case 'product':
                console.log('📦 Product item - skipping (not a pet)');
                return null;

            default:
                console.log('❌ Unknown item type:', orderItem.item_type);
        }
    } else if (orderItem.pet_id) {
        console.log('🔄 Legacy format detected - using pet_id');
        petData = orderItem.pet_id;
        petId = orderItem.pet_id._id;
    } else if (orderItem.variant_id?.pet_id) {
        console.log('🔄 Legacy variant format detected - using variant_id.pet_id');
        petData = orderItem.variant_id.pet_id;
        petId = orderItem.variant_id.pet_id._id;
    }

    if (!petData || !petId) {
        console.log('❌ Failed to extract pet data');
        return null;
    }

    console.log('✅ Pet data extracted:', { id: petId, name: petData.name, type: petData.type });

    return {
        _id: orderItem._id,
        pet_id: petData,
        quantity: orderItem.quantity,
        unit_price: orderItem.unit_price,
        order_id: orderItem.order_id,
        item_info: orderItem.item_info,
        item_type: orderItem.item_type,
        variant_id: orderItem.variant_id,
        images: orderItem.images
    };
};

const getBreedName = (pet: any, orderItem: PurchasedPetOrderItem): string => {
    if (pet.breed_id) {
        if (typeof pet.breed_id === 'object' && pet.breed_id.name) {
            return pet.breed_id.name;
        }
        if (typeof pet.breed_id === 'string' && pet.breed_id.trim()) {
            return pet.breed_id;
        }
    }

    const variantPetBreed = orderItem.variant_id?.pet_id?.breed_id;
    if (variantPetBreed) {
        if (typeof variantPetBreed === 'object' && variantPetBreed.name) {
            return variantPetBreed.name;
        }
        if (typeof variantPetBreed === 'string' && variantPetBreed.trim()) {
            return variantPetBreed;
        }
    }

    const itemBreed = orderItem.item_info?.breed_id;
    if (itemBreed) {
        if (typeof itemBreed === 'object' && itemBreed.name) {
            return itemBreed.name;
        }
        if (typeof itemBreed === 'string' && itemBreed.trim()) {
            return itemBreed;
        }
    }

    return '';
};

const getVariantInfo = (orderItem: PurchasedPetOrderItem): string => {
    const variant = orderItem.variant_id || orderItem.item_info?.variant;
    if (!variant) return '';

    const parts = [];
    if (variant.color) parts.push(`Màu: ${variant.color}`);
    if (variant.weight) parts.push(`${variant.weight}kg`);
    if (variant.gender) parts.push(variant.gender === 'male' ? 'Đực' : 'Cái');
    if (variant.age) parts.push(`${variant.age} Tuổi`);

    return parts.join(' • ');
};

const getPetImage = (pet: any, orderItem: PurchasedPetOrderItem): string => {
    const defaultImage = 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=100&h=100&fit=crop&crop=face';

    if (orderItem.images?.length > 0) {
        const primaryImg = orderItem.images.find(img => img.is_primary) || orderItem.images[0];
        if (primaryImg?.url) return primaryImg.url;
    }

    if (pet.images?.length > 0) {
        return pet.images[0].url;
    }

    return defaultImage;
};

const convertToPetFormat = (orderItem: PurchasedPetOrderItem): Pet | null => {
    const pet = orderItem.pet_id;
    if (!pet) return null;

    const petName = pet.name || 'Thú cưng';
    const petType = pet.type || '';
    const petBreed = getBreedName(pet, orderItem);
    const variantInfo = getVariantInfo(orderItem);
    const petImage = getPetImage(pet, orderItem);

    let petAge = 'Chưa rõ tuổi';
    if (orderItem.variant_id?.age) {
        petAge = `${orderItem.variant_id.age} Tuổi`;
    } else if (pet.age) {
        petAge = `${pet.age} Tuổi`;
    }

    return {
        id: pet._id,
        name: petName,
        type: petType,
        breed: variantInfo ? `${petBreed} (${variantInfo})` : petBreed,
        age: petAge,
        image: petImage
    };
};

const getServiceIcon = (category: string): string => {
    const icons = {
        bathing: '🛁',
        health: '🩺',
        grooming: '✂️',
        spa: '🐕'
    };
    return icons[category] || '🐕';
};

// ================================
// MAIN COMPONENT
// ================================

const PetCareBookingScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const dispatch = useDispatch<AppDispatch>();
    const { token, user } = useAuth();

    // Redux state
    const { services: backendServices, isLoading: servicesLoading } = useSelector((state: RootState) => state.careServices);
    const { availableSlots, isLoading: appointmentLoading } = useSelector((state: RootState) => state.appointments);
    const noShowStatus = useSelector(selectNoShowStatus); // ✅ Thêm selector cho no-show status

    // Component state
    const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'vnpay'>('cod');
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
        name: user?.username || '',
        phone: user?.phone || '',
        email: user?.email || '',
        notes: ''
    });
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [purchasedPets, setPurchasedPets] = useState<PurchasedPetOrderItem[]>([]);
    const [petsLoading, setPetsLoading] = useState(false);
    const pendingAppointment = useSelector(selectPendingAppointment);

    // VNPay related refs
    const isHandled = useRef(false);
    const appointmentDataRef = useRef<{
        pet: Pet | null;
        service: Service | null;
        date: string;
        time: string;
        customerInfo: CustomerInfo;
    }>({
        pet: null,
        service: null,
        date: '',
        time: '',
        customerInfo: {
            name: '',
            phone: '',
            email: '',
            notes: ''
        }
    });
    const SERVER_URLS = [API_BASE_URL.replace(/\/api$/, '')];

    // Update ref whenever state changes
    useEffect(() => {
        appointmentDataRef.current = {
            pet: selectedPet,
            service: selectedService,
            date: selectedDate,
            time: selectedTime,
            customerInfo
        };
    }, [selectedPet, selectedService, selectedDate, selectedTime, customerInfo]);

    // Computed values
    const pets: Pet[] = purchasedPets
        .map(convertToPetFormat)
        .filter((pet): pet is Pet => pet !== null);

    const services: Service[] = backendServices.map(service => ({
        id: service._id,
        name: service.name,
        price: service.price,
        duration: `${service.duration} phút`,
        description: service.description || '',
        icon: getServiceIcon(service.category)
    }));

    const timeSlots: TimeSlot[] = [
        { time: '08:00', available: Array.isArray(availableSlots) ? availableSlots.includes('08:00') : true },
        { time: '09:00', available: Array.isArray(availableSlots) ? availableSlots.includes('09:00') : true },
        { time: '10:00', available: Array.isArray(availableSlots) ? availableSlots.includes('10:00') : true },
        { time: '11:00', available: Array.isArray(availableSlots) ? availableSlots.includes('11:00') : true },
        { time: '14:00', available: Array.isArray(availableSlots) ? availableSlots.includes('14:00') : true },
        { time: '15:00', available: Array.isArray(availableSlots) ? availableSlots.includes('15:00') : true },
        { time: '16:00', available: Array.isArray(availableSlots) ? availableSlots.includes('16:00') : true },
        { time: '17:00', available: Array.isArray(availableSlots) ? availableSlots.includes('17:00') : true }
    ];

    // ================================
    // EFFECTS
    // ================================

    useEffect(() => {
        if (!token) {
            Alert.alert('Cảnh báo', 'Vui lòng đăng nhập để đặt lịch hẹn', [
                { text: 'OK', onPress: () => navigation.navigate('Login') }
            ]);
            return;
        }
        loadBackendData();
    }, [token]);

    useEffect(() => {
        if (selectedDate) {
            const dateParts = selectedDate.split('/');
            if (dateParts.length === 3) {
                const apiDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
                if (!isNaN(Date.parse(apiDate))) {
                    dispatch(getAvailableSlots(apiDate));
                }
            }
        }
    }, [selectedDate]);

    useEffect(() => {
        const handleDeepLink = async (event: { url: string }) => {
            const url = event.url;
            if (url.includes('payment-result') && !isHandled.current) {
                isHandled.current = true;
                await handleVNPayResponse(url);
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);

        Linking.getInitialURL().then(async (url) => {
            if (url && url.includes('payment-result') && !isHandled.current) {
                isHandled.current = true;
                await handleVNPayResponse(url);
            }
        });

        return () => {
            subscription.remove();
            // Reset isHandled after a timeout to allow retrying if needed
            setTimeout(() => { isHandled.current = false; }, 60000);
        };
    }, [navigation]);

    // ✅ Thêm effect: Fetch no-show status khi load backend data
    useEffect(() => {
        if (token) {
            dispatch(getNoShowStatus());
        }
    }, [token, dispatch]);

    // ✅ Thêm effect: Force VNPay nếu restricted
    useEffect(() => {
        if (noShowStatus.restricted) {
            setPaymentMethod('vnpay');
        }
    }, [noShowStatus]);

    // ================================
    // FUNCTIONS
    // ================================

    const loadBackendData = async () => {
        try {
            await dispatch(getAllServices({ active: true }));
            await loadPurchasedPets();
        } catch (error) {
            console.error('Error loading backend data:', error);
            Alert.alert('Lỗi', 'Không thể tải dữ liệu. Vui lòng thử lại.');
        }
    };

    const loadPurchasedPets = async () => {
        try {
            setPetsLoading(true);
            console.log('🔍 Loading purchased pets...');

            const response = await ordersService.getMyOrderItems({ limit: 100 });

            if (response.data && Array.isArray(response.data)) {
                console.log('✅ API call successful, processing data...');

                const petOrderItems = response.data
                    .map((item: ApiOrderItem) => extractPetFromOrderItem(item))
                    .filter((item): item is PurchasedPetOrderItem => item !== null);

                const uniquePets: PurchasedPetOrderItem[] = [];
                const seenPetIds = new Set<string>();

                petOrderItems.forEach((item) => {
                    const petId = item.pet_id?._id;
                    if (petId && !seenPetIds.has(petId)) {
                        seenPetIds.add(petId);
                        uniquePets.push(item);
                    }
                });

                setPurchasedPets(uniquePets);

                if (uniquePets.length === 0) {
                    Alert.alert(
                        'Thông báo',
                        'Bạn chưa mua thú cưng nào. Vui lòng mua thú cưng trước khi đặt lịch chăm sóc.',
                        [
                            { text: 'Mua thú cưng', onPress: () => navigation.navigate('PetAll') },
                            { text: 'Quay lại', onPress: () => navigation.goBack() }
                        ]
                    );
                }
            }
        } catch (error) {
            console.error('❌ Error loading purchased pets:', error);
            Alert.alert('Lỗi', 'Không thể tải danh sách thú cưng đã mua. Vui lòng thử lại.');
        } finally {
            setPetsLoading(false);
        }
    };

    const handleDateSelect = (day: { dateString: string }) => {
        const date = new Date(day.dateString);
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
        setSelectedDate(formattedDate);
        setShowCalendar(false);
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(price);
    };

    const handleVNPayPayment = async () => {
        if (!selectedPet || !selectedService || !selectedDate || !selectedTime || !customerInfo.name || !customerInfo.phone) {
            Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ thông tin để đặt lịch');
            return;
        }

        const selectedPetOrderItem = purchasedPets.find(item => item.pet_id?._id === selectedPet.id);
        const backendService = backendServices.find(s => s._id === selectedService.id);

        if (!selectedPetOrderItem?.pet_id || !backendService || !selectedPetOrderItem.order_id?._id) {
            Alert.alert('Lỗi', 'Không tìm thấy thông tin thú cưng, dịch vụ hoặc đơn hàng');
            return;
        }

        const dateParts = selectedDate.split('/');
        const apiDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;

        // Lưu thông tin lịch hẹn vào pendingAppointment
        const appointmentData = {
            pet_id: selectedPetOrderItem.pet_id._id,
            service_id: backendService._id,
            appointment_date: apiDate,
            appointment_time: selectedTime,
            notes: customerInfo.notes.trim() || undefined,
            order_id: selectedPetOrderItem.order_id._id,
            total_amount: backendService.price,
            item_type: selectedPetOrderItem.variant_id ? 'variant' : 'pet',
            payment_method: 'vnpay',
            ...(selectedPetOrderItem.variant_id?._id && { variant_id: selectedPetOrderItem.variant_id._id }),
        };

        console.log('Saving pending appointment:', appointmentData);
        dispatch(savePendingAppointment(appointmentData));
        let lastError = null;
        for (const serverUrl of SERVER_URLS) {
            try {
                console.log('Trying VNPay payment with server:', serverUrl);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(`${serverUrl}/create-vnpay-payment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        amount: backendService.price,
                        user_id: user._id,
                        pet_id: selectedPetOrderItem.pet_id._id,
                        service_id: backendService._id,
                        appointment_date: apiDate,
                        appointment_time: selectedTime,
                        notes: customerInfo.notes.trim() || '',
                        order_id: selectedPetOrderItem.order_id._id,
                        orderInfo: `Thanh toan lich hen cho don hang ${selectedPetOrderItem.order_id._id}`,
                        orderType: 'appointment',
                        ...(selectedPetOrderItem.variant_id?._id && { variant_id: selectedPetOrderItem.variant_id._id }),
                    }),
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorText}`);
                }

                const data = await response.json();
                console.log('VNPay API response:', data);

                if (!data.paymentUrl) {
                    throw new Error('Thiếu paymentUrl từ server');
                }

                const supported = await Linking.canOpenURL(data.paymentUrl);
                if (supported) {
                    await Linking.openURL(data.paymentUrl);
                    return;
                } else {
                    throw new Error('Không thể mở URL thanh toán VNPay');
                }
            } catch (error) {
                lastError = error;
                console.log('Failed VNPay connection to', serverUrl, 'Error:', error.message);
                continue;
            }
        }

        console.error('All VNPay connection attempts failed. Last error:', lastError);
        Alert.alert('Lỗi Thanh Toán VNPay', `Không thể kết nối đến máy chủ thanh toán VNPay: ${lastError?.message || 'Lỗi không xác định'}`);
    };

    const handleVNPayResponse = async (url: string) => {
        try {
            console.log('Processing VNPay response URL:', url);

            const urlObj = new URL(url);
            const urlParams = new URLSearchParams(urlObj.search);
            const vnpayData: VNPayResponse = {
                vnp_ResponseCode: urlParams.get('vnp_ResponseCode') || '',
                vnp_TransactionStatus: urlParams.get('vnp_TransactionStatus') || '',
                vnp_TxnRef: urlParams.get('vnp_TxnRef') || '',
                vnp_PayDate: urlParams.get('vnp_PayDate') || '',
                vnp_Amount: urlParams.get('vnp_Amount') || '',
            };

            console.log('VNPay response data:', vnpayData);

            if (!vnpayData.vnp_TxnRef) {
                throw new Error('Thiếu vnp_TxnRef trong phản hồi VNPay');
            }

            if (vnpayData.vnp_ResponseCode === '00' && vnpayData.vnp_TransactionStatus === '00') {
                // Truyền dispatch và pendingAppointment vào createAppointmentWithVNPay
                await createAppointmentWithVNPay(vnpayData, dispatch, pendingAppointment);
                Alert.alert('Thành công', 'Thanh toán VNPay và đặt lịch thành công!');
            } else {
                const errorMessages = {
                    '07': 'Giao dịch đang được kiểm tra',
                    '09': 'Thẻ hoặc tài khoản không hợp lệ',
                    '10': 'Người dùng hủy giao dịch',
                    '24': 'Người dùng hủy giao dịch',
                };
                const errorMessage = errorMessages[vnpayData.vnp_ResponseCode] || `Thanh toán VNPay thất bại: Mã lỗi ${vnpayData.vnp_ResponseCode}`;
                Alert.alert('Lỗi Thanh Toán', errorMessage);
                console.error('VNPay payment failed:', vnpayData);
                dispatch(clearPendingAppointment());
            }
        } catch (error: any) {
            console.error('Error handling VNPay response:', error);
            Alert.alert('Lỗi', `Có lỗi xảy ra khi xử lý kết quả thanh toán: ${error.message}`);
            dispatch(clearPendingAppointment());
        } finally {
            isHandled.current = false;
        }
    };
    const createAppointmentWithVNPay = async (
        vnpayData: VNPayResponse,
        dispatch: AppDispatch,
        pendingAppointment: any // Thay any bằng CreateAppointmentRequest | null nếu đã định nghĩa type
    ) => {
        try {
            if (!pendingAppointment) {
                console.error('No pending appointment found');
                Alert.alert('Lỗi', 'Không tìm thấy thông tin đặt lịch tạm thời. Vui lòng thử lại.');
                return;
            }

            const appointmentData = {
                ...pendingAppointment,
                vnpay_transaction_id: vnpayData.vnp_TxnRef,
            };

            console.log('Creating appointment with VNPay data:', appointmentData);

            const result = await dispatch(createAppointment(appointmentData)).unwrap();
            console.log('Appointment created successfully:', result);

            dispatch(clearPendingAppointment());
            setShowConfirmation(true);
        } catch (error: any) {
            console.error('VNPay Appointment creation error:', error);
            const errorMessage = error.message || 'Không thể đặt lịch hẹn. Vui lòng thử lại.';
            Alert.alert('Lỗi Đặt Lịch', errorMessage);
        }
    };

    const handleBooking = async () => {
        if (!selectedPet || !selectedService || !selectedDate || !selectedTime || !customerInfo.name || !customerInfo.phone) {
            Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ thông tin để đặt lịch');
            return;
        }

        // ✅ Thêm check restricted trước khi proceed
        if (noShowStatus.restricted && paymentMethod === 'cod') {
            Alert.alert(
                'Cảnh báo',
                `Bạn đã không đến lịch hẹn ${noShowStatus.noShowCount} lần trong 3 tháng qua. Vui lòng sử dụng thanh toán VNPay để đặt lịch.`
            );
            setPaymentMethod('vnpay');
            return;
        }

        if (paymentMethod === 'vnpay') {
            await handleVNPayPayment();
            return;
        }

        try {
            const dateParts = selectedDate.split('/');
            const apiDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;

            const selectedPetOrderItem = purchasedPets.find(item => item.pet_id?._id === selectedPet?.id);
            const backendService = backendServices.find(s => s._id === selectedService.id);

            if (!selectedPetOrderItem?.pet_id || !backendService || !selectedPetOrderItem.order_id?._id) {
                Alert.alert('Lỗi', 'Không tìm thấy thông tin cần thiết để đặt lịch');
                return;
            }

            const appointmentData = {
                pet_id: selectedPetOrderItem.pet_id._id,
                service_id: backendService._id,
                appointment_date: apiDate,
                appointment_time: selectedTime,
                notes: customerInfo.notes.trim() || undefined,
                order_id: selectedPetOrderItem.order_id._id,
                total_amount: backendService.price,
                item_type: selectedPetOrderItem.variant_id ? 'variant' : 'pet',
                payment_method: 'cod',
                ...(selectedPetOrderItem.variant_id?._id && { variant_id: selectedPetOrderItem.variant_id._id })
            };

            console.log('Creating appointment with COD data:', appointmentData);

            const result = await dispatch(createAppointment(appointmentData)).unwrap();
            console.log('Appointment created successfully:', result);

            setShowConfirmation(true);
        } catch (error: any) {
            console.error('❌ Appointment creation error:', error);
            Alert.alert('Lỗi', error.message || 'Không thể đặt lịch hẹn. Vui lòng thử lại.');
        }
    };

    // ✅ Cập nhật hàm setPaymentMethod để check restricted
    const handleSetPaymentMethod = (method: 'cod' | 'vnpay') => {
        if (noShowStatus.restricted && method === 'cod') {
            Alert.alert(
                'Cảnh báo',
                `Bạn đã không đến lịch hẹn ${noShowStatus.noShowCount} lần trong 3 tháng qua. Vui lòng sử dụng thanh toán VNPay.`
            );
            return;
        }
        setPaymentMethod(method);
    };

    const resetForm = () => {
        setSelectedPet(null);
        setSelectedService(null);
        setSelectedDate('');
        setSelectedTime('');
        setPaymentMethod('cod');
        setCustomerInfo({
            name: user?.username || '',
            phone: user?.phone || '',
            email: user?.email || '',
            notes: ''
        });
        setShowConfirmation(false);
    };

    // ================================
    // RENDER FUNCTIONS
    // ================================

    const renderPetItem = ({ item }: { item: Pet }) => (
        <TouchableOpacity
            style={[styles.petItem, selectedPet?.id === item.id && styles.selectedItem]}
            onPress={() => setSelectedPet(item)}
        >
            <Image source={{ uri: item.image }} style={styles.petImage} />
            <View style={styles.petInfo}>
                <Text style={styles.petName}>{item.name}</Text>
                <Text style={styles.petDetails}>{item.type} - {item.breed}</Text>
                <Text style={styles.petAge}>{item.age}</Text>
            </View>
            {selectedPet?.id === item.id && (
                <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
            )}
        </TouchableOpacity>
    );

    const renderServiceItem = ({ item }: { item: Service }) => (
        <TouchableOpacity
            style={[styles.serviceItem, selectedService?.id === item.id && styles.selectedItem]}
            onPress={() => setSelectedService(item)}
        >
            <View style={styles.serviceHeader}>
                <View style={styles.serviceIconContainer}>
                    <Text style={styles.serviceIcon}>{item.icon}</Text>
                    <View>
                        <Text style={styles.serviceName}>{item.name}</Text>
                        <Text style={styles.serviceDuration}>{item.duration}</Text>
                    </View>
                </View>
                {selectedService?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                )}
            </View>
            <Text style={styles.serviceDescription}>{item.description}</Text>
            <Text style={styles.servicePrice}>{formatPrice(item.price)}</Text>
        </TouchableOpacity>
    );

    const renderTimeSlot = ({ item }: { item: TimeSlot }) => (
        <TouchableOpacity
            style={[
                styles.timeSlot,
                selectedTime === item.time && styles.selectedTimeSlot,
                !item.available && styles.unavailableTimeSlot
            ]}
            onPress={() => item.available && setSelectedTime(item.time)}
            disabled={!item.available}
        >
            <Text style={[
                styles.timeSlotText,
                selectedTime === item.time && styles.selectedTimeSlotText,
                !item.available && styles.unavailableTimeSlotText
            ]}>
                {item.time}
            </Text>
        </TouchableOpacity>
    );

    // ================================
    // CONFIRMATION SCREEN
    // ================================

    if (showConfirmation) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.confirmationContainer}>
                    <View style={styles.confirmationCard}>
                        <View style={styles.successIcon}>
                            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                        </View>
                        <Text style={styles.confirmationTitle}>Đặt lịch thành công!</Text>
                        <Text style={styles.confirmationMessage}>
                            {paymentMethod === 'vnpay' ?
                                'Thanh toán VNPay đã hoàn tất và lịch hẹn được đặt thành công. Nhân viên sẽ liên hệ xác nhận trong vòng 30 phút.' :
                                'Chúng tôi đã nhận được yêu cầu đặt lịch của bạn. Nhân viên sẽ liên hệ xác nhận trong vòng 30 phút.'
                            }
                        </Text>
                        <View style={styles.bookingInfo}>
                            <Text style={styles.bookingInfoTitle}>Thông tin đặt lịch:</Text>
                            <Text style={styles.bookingInfoItem}>• Thú cưng: {selectedPet?.name} {selectedPet?.type}</Text>
                            <Text style={styles.bookingInfoItem}>• Dịch vụ: {selectedService?.name}</Text>
                            <Text style={styles.bookingInfoItem}>• Ngày: {selectedDate}</Text>
                            <Text style={styles.bookingInfoItem}>• Giờ: {selectedTime}</Text>
                            <Text style={styles.bookingInfoItem}>• Thanh toán: {paymentMethod === 'vnpay' ? 'VNPay (Đã thanh toán)' : 'COD'}</Text>
                            <Text style={styles.bookingInfoItem}>• Tổng tiền: {formatPrice(selectedService?.price || 0)}</Text>
                        </View>
                        <View style={styles.confirmationButtons}>
                            <TouchableOpacity
                                style={styles.historyButton}
                                onPress={() => navigation.navigate('AppointmentHistory')}
                            >
                                <Text style={styles.historyButtonText}>Xem lịch hẹn</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.newBookingButton}
                                onPress={resetForm}
                            >
                                <Text style={styles.newBookingButtonText}>Đặt lịch mới</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // ================================
    // MAIN RENDER
    // ================================

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color="#374151" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Đặt lịch chăm sóc thú cưng</Text>
            </View>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <View style={styles.progressContainer}>
                        <View style={styles.progressStep}>
                            <View style={[styles.progressCircle, styles.activeProgress]}>
                                <Text style={styles.progressText}>1</Text>
                            </View>
                            <Text style={styles.progressLabel}>Chọn thú cưng</Text>
                        </View>
                        <View style={styles.progressLine} />
                        <View style={styles.progressStep}>
                            <View style={[styles.progressCircle, selectedPet && styles.activeProgress]}>
                                <Text style={styles.progressText}>2</Text>
                            </View>
                            <Text style={styles.progressLabel}>Chọn dịch vụ</Text>
                        </View>
                        <View style={styles.progressLine} />
                        <View style={styles.progressStep}>
                            <View style={[styles.progressCircle, selectedService && styles.activeProgress]}>
                                <Text style={styles.progressText}>3</Text>
                            </View>
                            <Text style={styles.progressLabel}>Thời gian & thanh toán</Text>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="heart" size={24} color="#EC4899" />
                            <Text style={styles.sectionTitle}>Chọn thú cưng đã mua</Text>
                        </View>
                        {petsLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="#3B82F6" />
                                <Text style={styles.loadingText}>Đang tải thú cưng đã mua...</Text>
                            </View>
                        ) : pets.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="sad-outline" size={48} color="#9CA3AF" />
                                <Text style={styles.emptyText}>
                                    Bạn chưa mua thú cưng nào.{'\n'}
                                    Vui lòng mua thú cưng trước khi đặt lịch chăm sóc.
                                </Text>
                                <TouchableOpacity
                                    style={[styles.bookingButton, styles.buyPetButton]}
                                    onPress={() => navigation.navigate('PetAll')}
                                >
                                    <Text style={styles.bookingButtonText}>Mua thú cưng ngay</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <FlatList
                                data={pets}
                                renderItem={renderPetItem}
                                keyExtractor={(item) => item.id}
                                scrollEnabled={false}
                            />
                        )}
                    </View>

                    {selectedPet && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="card" size={24} color="#10B981" />
                                <Text style={styles.sectionTitle}>Chọn dịch vụ</Text>
                            </View>
                            {servicesLoading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="small" color="#3B82F6" />
                                </View>
                            ) : (
                                <FlatList
                                    data={services}
                                    renderItem={renderServiceItem}
                                    keyExtractor={(item) => item.id}
                                    scrollEnabled={false}
                                />
                            )}
                        </View>
                    )}

                    {selectedService && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="calendar" size={24} color="#8B5CF6" />
                                <Text style={styles.sectionTitle}>Chọn ngày & giờ</Text>
                            </View>
                            <Text style={styles.inputLabel}>Chọn ngày</Text>
                            <TouchableOpacity
                                style={styles.dateInput}
                                onPress={() => setShowCalendar(true)}
                            >
                                <Text style={styles.dateInputText}>
                                    {selectedDate || 'DD/MM/YYYY'}
                                </Text>
                            </TouchableOpacity>

                            <Text style={styles.inputLabel}>Chọn giờ</Text>
                            {appointmentLoading && selectedDate ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="small" color="#3B82F6" />
                                </View>
                            ) : (
                                <FlatList
                                    data={timeSlots}
                                    renderItem={renderTimeSlot}
                                    keyExtractor={(item) => item.time}
                                    numColumns={4}
                                    scrollEnabled={false}
                                    columnWrapperStyle={styles.timeSlotRow}
                                />
                            )}
                        </View>
                    )}

                    {selectedTime && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="card" size={24} color="#F59E0B" />
                                <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
                            </View>
                            {/* ✅ Thêm thông báo nếu restricted */}
                            {noShowStatus.restricted && (
                                <Text style={styles.restrictedNote}>
                                    Bạn đã không đến {noShowStatus.noShowCount} lần trong 3 tháng. Chỉ có thể thanh toán qua VNPay.
                                </Text>
                            )}
                            <TouchableOpacity
                                style={[
                                    styles.paymentOption, 
                                    paymentMethod === 'cod' && styles.paymentSelected,
                                    noShowStatus.restricted && styles.disabledPayment // ✅ Disable style nếu restricted
                                ]}
                                onPress={() => handleSetPaymentMethod('cod')} // ✅ Sử dụng hàm mới
                                disabled={noShowStatus.restricted} // ✅ Disable nếu restricted
                            >
                                <FontAwesome5 name="money-check" size={20} color="#10B981" style={styles.paymentIcon} />
                                <View style={styles.paymentInfo}>
                                    <Text style={styles.paymentText}>Thanh toán khi nhận dịch vụ</Text>
                                    <Text style={styles.paymentDescription}>Thanh toán tiền mặt tại cửa hàng</Text>
                                </View>
                                <View style={styles.radioCircle}>
                                    {paymentMethod === 'cod' && <View style={styles.selectedDot} />}
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.paymentOption, paymentMethod === 'vnpay' && styles.paymentSelected]}
                                onPress={() => handleSetPaymentMethod('vnpay')} // ✅ Sử dụng hàm mới
                            >
                                <FontAwesome5 name="credit-card" size={20} color="#1976D2" style={styles.paymentIcon} />
                                <View style={styles.paymentInfo}>
                                    <Text style={styles.paymentText}>Thanh toán qua VNPay</Text>
                                    <Text style={styles.paymentDescription}>An toàn, tiện lợi, hỗ trợ nhiều ngân hàng</Text>
                                </View>
                                <View style={styles.radioCircle}>
                                    {paymentMethod === 'vnpay' && <View style={styles.selectedDot} />}
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedTime && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="person" size={24} color="#F59E0B" />
                                <Text style={styles.sectionTitle}>Thông tin khách hàng</Text>
                            </View>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Họ và tên *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={customerInfo.name}
                                    onChangeText={(text) => setCustomerInfo({ ...customerInfo, name: text })}
                                    placeholder="Nhập họ và tên"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Số điện thoại *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={customerInfo.phone}
                                    onChangeText={(text) => setCustomerInfo({ ...customerInfo, phone: text })}
                                    placeholder="Nhập số điện thoại"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="phone-pad"
                                />
                            </View>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Email</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={customerInfo.email}
                                    onChangeText={(text) => setCustomerInfo({ ...customerInfo, email: text })}
                                    placeholder="Nhập email"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="email-address"
                                />
                            </View>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Ghi chú</Text>
                                <TextInput
                                    style={[styles.textInput, styles.notesInput]}
                                    value={customerInfo.notes}
                                    onChangeText={(text) => setCustomerInfo({ ...customerInfo, notes: text })}
                                    placeholder="Ghi chú thêm (tùy chọn)"
                                    placeholderTextColor="#9CA3AF"
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>
                        </View>
                    )}

                    {selectedTime && customerInfo.name && customerInfo.phone && (
                        <View style={styles.summarySection}>
                            <Text style={styles.summaryTitle}>Tóm tắt đặt lịch</Text>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Thú cưng:</Text>
                                <Text style={styles.summaryValue}>{selectedPet?.name} {selectedPet?.type}</Text>
                            </View>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Dịch vụ:</Text>
                                <Text style={styles.summaryValue}>{selectedService?.name}</Text>
                            </View>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Ngày giờ:</Text>
                                <Text style={styles.summaryValue}>{selectedDate} - {selectedTime}</Text>
                            </View>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Thời gian:</Text>
                                <Text style={styles.summaryValue}>{selectedService?.duration}</Text>
                            </View>
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryLabel}>Thanh toán:</Text>
                                <Text style={styles.summaryValue}>
                                    {paymentMethod === 'vnpay' ? 'VNPay (Trực tuyến)' : 'COD'}
                                </Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryTotalLabel}>Tổng tiền:</Text>
                                <Text style={styles.summaryTotalValue}>
                                    {formatPrice(selectedService?.price || 0)}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.bookingButton,
                                    appointmentLoading && styles.disabledButton
                                ]}
                                onPress={handleBooking}
                                disabled={appointmentLoading}
                            >
                                {appointmentLoading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.bookingButtonText}>
                                        {paymentMethod === 'vnpay' ? 'Thanh toán VNPay' : 'Xác nhận đặt lịch'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                            {paymentMethod === 'vnpay' && (
                                <Text style={styles.paymentNote}>
                                    Bạn sẽ được chuyển đến trang thanh toán VNPay để hoàn tất giao dịch
                                </Text>
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>

            <Modal
                visible={showCalendar}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowCalendar(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.calendarContainer}>
                        <Calendar
                            onDayPress={handleDateSelect}
                            minDate={new Date().toISOString().split('T')[0]}
                            theme={{
                                selectedDayBackgroundColor: '#3B82F6',
                                todayTextColor: '#3B82F6',
                                arrowColor: '#3B82F6',
                            }}
                        />
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setShowCalendar(false)}
                        >
                            <Text style={styles.closeButtonText}>Đóng</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

// ================================
// STYLES
// ================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        marginTop: 20
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#374151',
    },

    scrollContainer: {
        flex: 1,
    },
    content: {
        padding: 16,
    },

    // Progress Indicator
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    progressStep: {
        alignItems: 'center',
    },
    progressCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    activeProgress: {
        backgroundColor: '#3B82F6',
    },
    progressText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    progressLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    progressLine: {
        width: 32,
        height: 1,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 8,
    },

    // Section Styles
    section: {
        marginBottom: 24,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#374151',
        marginLeft: 8,
    },

    // Loading & Empty States
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#6B7280',
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        marginTop: 10,
        color: '#6B7280',
        textAlign: 'center',
    },

    // Pet Items
    petItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        marginBottom: 8,
    },
    selectedItem: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    petImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 12,
    },
    petInfo: {
        flex: 1,
    },
    petName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#374151',
    },
    petDetails: {
        fontSize: 14,
        color: '#6B7280',
    },
    petAge: {
        fontSize: 12,
        color: '#9CA3AF',
    },

    // Service Items
    serviceItem: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        marginBottom: 8,
    },
    serviceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    serviceIconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    serviceIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#374151',
    },
    serviceDuration: {
        fontSize: 12,
        color: '#6B7280',
    },
    serviceDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    servicePrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3B82F6',
    },

    // Payment Options
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    paymentSelected: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    paymentIcon: {
        width: 30,
        textAlign: 'center',
        marginRight: 12,
    },
    paymentInfo: {
        flex: 1,
    },
    paymentText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 2,
    },
    paymentDescription: {
        fontSize: 12,
        color: '#6B7280',
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#3B82F6',
    },

    // ✅ Thêm style cho disable payment và note restricted
    disabledPayment: {
        opacity: 0.5,
        backgroundColor: '#F3F4F6',
    },
    restrictedNote: {
        fontSize: 14,
        color: '#EF4444',
        marginBottom: 12,
        textAlign: 'center',
    },

    // Form Inputs
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    dateInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#FFFFFF',
        marginBottom: 16,
    },
    dateInputText: {
        fontSize: 16,
        color: '#374151',
    },
    inputContainer: {
        marginBottom: 16,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#FFFFFF',
    },
    notesInput: {
        height: 80,
        textAlignVertical: 'top',
    },

    // Time Slots
    timeSlotRow: {
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    timeSlot: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        marginHorizontal: 2,
    },
    selectedTimeSlot: {
        backgroundColor: '#3B82F6',
    },
    unavailableTimeSlot: {
        backgroundColor: '#F9FAFB',
    },
    timeSlotText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    selectedTimeSlotText: {
        color: '#FFFFFF',
    },
    unavailableTimeSlotText: {
        color: '#9CA3AF',
    },

    // Summary Section
    summarySection: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 16,
    },
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        textAlign: 'right',
        flex: 1,
        marginLeft: 8,
        marginLeft: 8,
        paddingLeft: 8,
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 8,
    },
    summaryTotalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#374151',
    },
    summaryTotalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#3B82F6',
    },
    paymentNote: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
        fontStyle: 'italic',
    },

    // Buttons
    bookingButton: {
        backgroundColor: '#3B82F6',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    buyPetButton: {
        backgroundColor: '#10B981',
        marginTop: 15,
    },
    disabledButton: {
        backgroundColor: '#9CA3AF',
    },
    bookingButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },

    // Confirmation Screen
    confirmationContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    confirmationCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
        width: '100%',
        maxWidth: 400,
    },
    successIcon: {
        marginBottom: 24,
    },
    confirmationTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 16,
        textAlign: 'center',
    },
    confirmationMessage: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    bookingInfo: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        width: '100%',
    },
    bookingInfoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 8,
    },
    bookingInfoItem: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    newBookingButton: {
        backgroundColor: '#3B82F6',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        width: '100%',
    },
    newBookingButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },

    // Modal
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    calendarContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        width: '90%',
        maxWidth: 400,
    },
    closeButton: {
        backgroundColor: '#3B82F6',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    closeButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});

export default PetCareBookingScreen;
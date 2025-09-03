import { useNavigation } from '@react-navigation/native';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { NotificationBadge } from '../../components/NotificationBadge';
import { useAuth } from '../../hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import LoginRequired from '../components/LoginRequired';
import { NotificationType } from '../services/NotificationService';

export default function PushNotificationScreen() {
  const navigation = useNavigation<any>();
  const { token } = useAuth();
  const {
    notifications,
    unreadCount,
    isLoading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    initializePushNotifications,
  } = usePushNotifications();

  useEffect(() => {
    console.log('🔄 PushNotificationScreen mounted, token:', !!token);
    console.log('🔔 Current notifications count:', notifications.length);
    console.log('📊 Unread count:', unreadCount);
    
    // Chỉ refresh notifications khi có token
    if (token) {
      console.log('🔄 Refreshing notifications...');
      refreshNotifications();
    } else {
      console.log('⚠️ No token found, skipping refresh');
    }
  }, [token]);

  const handleNotificationPress = async (notification: NotificationType) => {
    // Đánh dấu đã đọc
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    // Navigate tới screen tương ứng
    try {
      switch (notification.type) {
        case 'order':
          // Kiểm tra xem route có tồn tại không
          if (navigation.getState().routeNames.includes('OrderDetail')) {
            navigation.navigate('OrderDetail', { orderId: notification.relatedEntityId });
          } else {
            console.log('OrderDetail not found, navigating to History');
            navigation.navigate('History');
          }
          break;
        case 'chat':
          if (navigation.getState().routeNames.includes('CustomerSupport')) {
            navigation.navigate('CustomerSupport', { userId: notification.data?.senderId });
          } else {
            console.log('CustomerSupport screen not found');
          }
          break;
        case 'appointment':
          if (navigation.getState().routeNames.includes('AppointmentHistory')) {
            navigation.navigate('AppointmentHistory', { appointmentId: notification.relatedEntityId });
          } else {
            console.log('AppointmentHistory not found');
          }
          break;
        case 'promotion':
          // Thử navigate đến màn hình voucher hoặc home
          if (navigation.getState().routeNames.includes('Voucher')) {
            navigation.navigate('Voucher');
          } else {
            console.log('Voucher not found, navigating to app (main screen)');
            navigation.navigate('app');
          }
          break;
        case 'review':
          if (navigation.getState().routeNames.includes('Reviews')) {
            navigation.navigate('Reviews', { productId: notification.relatedEntityId });
          } else if (navigation.getState().routeNames.includes('ProductDetail')) {
            navigation.navigate('ProductDetail', { productId: notification.relatedEntityId });
          } else {
            console.log('Reviews not found');
          }
          break;
        case 'sale':
          if (navigation.getState().routeNames.includes('ProductDetail')) {
            navigation.navigate('ProductDetail', { productId: notification.relatedEntityId });
          } else {
            console.log('ProductDetail not found');
          }
          break;
        default:
          console.log('Unknown notification type:', notification.type);
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const handleMarkAllAsRead = () => {
    Alert.alert(
      'Đánh dấu tất cả đã đọc',
      'Bạn có muốn đánh dấu tất cả thông báo là đã đọc?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đồng ý', onPress: markAllAsRead },
      ]
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return '📦';
      case 'appointment':
        return '📅';
      case 'chat':
        return '💬';
      case 'promotion':
        return '🎉';
      case 'review':
        return '⭐';
      case 'sale':
        return '🏷️';
      case 'welcome':
        return '👋';
      default:
        return '🔔';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
      return 'Vừa xong';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} phút trước`;
    } else if (diffInHours < 24) {
      return `${diffInHours} giờ trước`;
    } else if (diffInDays < 7) {
      return `${diffInDays} ngày trước`;
    } else {
      return date.toLocaleDateString('vi-VN');
    }
  };

  const renderNotificationItem = ({ item }: { item: NotificationType }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.isRead && styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationIcon}>
        <Text style={styles.iconText}>{getNotificationIcon(item.type)}</Text>
      </View>
      
      <View style={styles.notificationContent}>
        <Text style={[
          styles.notificationTitle,
          !item.isRead && styles.unreadText
        ]}>
          {item.title}
        </Text>
        <Text style={styles.notificationBody} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.notificationTime}>
          {formatDate(item.createdAt)}
        </Text>
      </View>
      
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    // Nếu chưa đăng nhập, hiển thị message khác
    if (!token) {
      return (
        <View style={styles.emptyState}>
          <LoginRequired
            title="Yêu cầu đăng nhập"
            description="Bạn cần đăng nhập để xem thông báo"
            primaryLabel="Đăng nhập"
            onPrimaryPress={() => navigation.navigate('Login')}
            showCreateAccount={false}
            showGuestLink={true}
            onGuestPress={() => navigation.navigate('Home')}
          />
        </View>
      );
    }

    // Đã đăng nhập nhưng chưa có notifications
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🔔</Text>
        <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
        <Text style={styles.emptyText}>
          Các thông báo mới sẽ hiển thị ở đây
        </Text>
        
        {/* Button để xin quyền thông báo */}
        <TouchableOpacity 
          style={styles.enableNotificationButton}
          onPress={() => initializePushNotifications()}
        >
          <Icon name="bell" size={18} color="#007AFF" />
          <Text style={styles.enableNotificationText}>
            Bật thông báo
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Thông báo</Text>
        
        <View style={styles.headerRight}>
          {token && unreadCount > 0 && (
            <NotificationBadge style={styles.headerBadge} />
          )}
          {token && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={handleMarkAllAsRead}
            >
              <Icon name="check-circle" size={24} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats - chỉ hiển thị khi đã đăng nhập */}
      {token && (
        <View style={styles.stats}>
          <Text style={styles.statsText}>
            {unreadCount > 0 
              ? `${unreadCount} thông báo chưa đọc`
              : 'Tất cả đã đọc'
            }
          </Text>
        </View>
      )}

      {/* Notifications List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Đang tải thông báo...</Text>
        </View>
      ) : (
        <>
          
          
          <FlatList
            data={token ? notifications : []} // Chỉ hiển thị data khi có token
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id}
            refreshControl={
              token ? (
                <RefreshControl
                  refreshing={isLoading}
                  onRefresh={refreshNotifications}
                  colors={['#007AFF']}
                />
              ) : undefined
            }
            ListEmptyComponent={renderEmptyState}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              (!token || notifications.length === 0) ? styles.emptyContainer : undefined
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    marginTop: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBadge: {
    marginRight: 8,
  },
  markAllButton: {
    padding: 8,
  },
  stats: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  unreadNotification: {
    backgroundColor: '#f8f9ff',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: 'bold',
  },
  notificationBody: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginLeft: 8,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  enableNotificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  enableNotificationText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  loginButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  debugInfo: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    margin: 10,
    borderRadius: 5,
  },
});
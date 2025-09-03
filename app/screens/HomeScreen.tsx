import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

// Import components and services
import { NotificationBadge } from '../../components/NotificationBadge';
import { useAuth } from '../../hooks/redux';
import BannerSlider from '../components/BannerSlider'; // Điều chỉnh path theo cấu trúc project
import ChatSupportButton from '../components/ChatSupportButton';
import HomeSearchBar from '../components/HomeSearchBar';
import PetList from '../components/Pet/PetList';
import ProductList from '../components/ProductList';
import { petsService, productsService } from '../services/api-services';
import { categoriesService, Category } from '../services/categoriesService';
import { Pet, PetVariant, Product } from '../types';
import PetVariantHelpers from '../utils/petVariantHelpers'; // 🆕 Import shared utility

// 🔧 REMOVED: Local PetVariant Helpers - sử dụng shared utility thay thế

// Safe navigation helper
const safeNavigate = (navigation: any, routeName: string, params?: any) => {
  try {
    navigation.navigate(routeName, params);
  } catch (error) {
    console.warn(`Route '${routeName}' not found, navigating to Search instead`);
    try {
      navigation.navigate('Search', params);
    } catch (fallbackError) {
      console.error('Even Search route not found:', fallbackError);
    }
  }
};

const HomeScreen = () => {
  const navigation = useNavigation() as any;
  const route = useRoute();
  const { token } = useAuth();
  const [banners, setBanners] = useState([
    {
      id: '1',
      image: 'https://lh3.googleusercontent.com/proxy/YGBdiGmx0h-riNmW-TPMA_o5BY-9hLAuEmu3CwdtbG7BN8yo2AevyQgu5TM49Bwuo0GM1eNd1XNVOqoIvF1IVHhFHTDzuy-xPBdGZXfQlK2AY2Xrspkrlz0-8nvwkMagvkGE0JFNUx0gK9O0',
      // title: 'Chào mừng đến Pet Shop',
      // subtitle: 'Tìm thú cưng yêu thích của bạn',
      onPress: () => safeNavigate(navigation, 'PetAll'),
    },
    {
      id: '2',
      image: 'https://vetad.net/wp-content/uploads/2018/10/Banner3-1.jpg',
      // title: 'Khuyến mãi đặc biệt',
      // subtitle: 'Giảm giá 20% cho tất cả thú cưng',
      onPress: () => safeNavigate(navigation, 'Promotions'),
    },
    {
      id: '3',
      image: 'https://cdn.shopify.com/s/files/1/0268/6861/files/cat-supplies-checklist_600x600.jpg?v=1571152745',
      // title: 'Phụ kiện thú cưng',
      // subtitle: 'Đầy đủ phụ kiện chăm sóc',
      onPress: () => safeNavigate(navigation, 'ProductAll'),
    },
    {
      id: '4',
      image: 'https://www.petlandcanada.com/assets/images/blog/caring-for-a-puppy.jpg',
      // title: 'Dịch vụ chăm sóc',
      // subtitle: 'Spa, tắm rửa, cắt tỉa lông',
      onPress: () => safeNavigate(navigation, 'Services'),
    },
  ]);

  // Main data state
  const [pets, setPets] = useState<Pet[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [petsLoading, setPetsLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔧 UPDATED Fallback data - Pet không có price
  const fallbackCategories = [
    { _id: '1', name: 'Cats', images: [{ url: 'https://file.hstatic.net/200000108863/file/3_33cbf6a0308e40ca8962af5e0460397c_grande.png' }] },
  ];

  const fallbackPets = [
    {
      _id: '1',
      name: 'British Longhair Cat',
      images: [{ url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSSgjs2sCO0xh0Ve1Sf8mDtBt2UhO9GRZImDw&s' }],
      breed_id: { name: 'British' },
      variants: [
        {
          _id: 'v1',
          color: 'Golden',
          weight: 3,
          gender: 'Male',
          age: 1,
          selling_price: 5000000,
          import_price: 4500000,
          is_available: true,
          stock_quantity: 2
        }
      ]
    },
  ];

  const fallbackProducts = [
    { _id: '1', name: 'Dog Food Premium', images: [{ url: 'https://bizweb.dktcdn.net/100/165/948/products/img-5830-jpg.jpg?v=1502808189430' }], price: 250000, category: 'Food' },
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all data in parallel
      await Promise.all([
        loadCategories(),
        loadPets(),
        loadProducts(),
      ]);

    } catch (error: any) {
      setError(error.message || 'Failed to load data');

      Alert.alert(
        'Loading Error',
        'Some data could not be loaded. Using offline data.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      setCategoriesLoading(true);
      const response = await categoriesService.getCategories();
      if (response.success && response.data && response.data.length > 0) {
        setCategories(response.data);
      } else {
        setCategories(fallbackCategories as Category[]);
      }
    } catch (error: any) {
      console.log('Categories loading failed, using fallback');
      setCategories(fallbackCategories as Category[]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadPets = async () => {
    try {
      setPetsLoading(true);
      const response = await petsService.getPets({ page: 1, limit: 6 });
      if (response.success && response.data && response.data.length > 0) {
        console.log('🐾 Loaded pets:', response.data.length);

        // 🔧 ENHANCED logging với shared helpers
        response.data.forEach((pet: Pet, index: number) => {
          console.log(`\n=== Pet ${index + 1}: ${pet.name} ===`);
          console.log('Full pet object keys:', Object.keys(pet));
          console.log(`Pet type: ${pet.type}`);
          console.log(`Has variants: ${pet.variants ? 'Yes' : 'No'}`);

          if (pet.variants && pet.variants.length > 0) {
            // 🔧 Sử dụng shared helpers để log
            const summary = PetVariantHelpers.getVariantSummary(pet);
            const minPrice = PetVariantHelpers.getPetPrice(pet);
            const maxPrice = PetVariantHelpers.getPetMaxPrice(pet);
            const shouldShowFrom = PetVariantHelpers.shouldShowPricePrefix(pet);

            console.log(`📊 Variant summary:`, summary);
            console.log(`💰 Price: ${minPrice} - ${maxPrice} (show "Từ": ${shouldShowFrom})`);

            pet.variants.forEach((variant: PetVariant, vIndex: number) => {
              const finalPrice = PetVariantHelpers.getFinalPrice(variant);
              const isAvailable = PetVariantHelpers.isVariantAvailable(variant);

              console.log(`  Variant ${vIndex + 1}:`, {
                color: variant.color,
                final_price: finalPrice,
                is_available: isAvailable,
                stock: variant.stock_quantity
              });
            });
          } else {
            console.log('❌ No variants - will use fallback pricing');
            console.log(`Pet price field: ${(pet as any).price}`);
          }
        });

        setPets(response.data);
      } else {
        console.log('No pets from API, using fallback');
        setPets(fallbackPets as Pet[]);
      }
    } catch (error: any) {
      console.log('Pets loading failed, using fallback:', error);
      setPets(fallbackPets as Pet[]);
    } finally {
      setPetsLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      setProductsLoading(true);
      const response = await productsService.getProducts({ page: 1, limit: 10 });
      if (response.success && response.data?.products?.length > 0) {
        setProducts(response.data.products);
      } else {
        setProducts(fallbackProducts as Product[]);
      }
    } catch (error: any) {
      console.log('Products loading failed, using fallback');
      setProducts(fallbackProducts as Product[]);
    } finally {
      setProductsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  };

  // 🔧 UPDATED handlePetPress sử dụng shared helpers
  const handlePetPress = (pet: Pet) => {
    console.log(`\n🎯 Pet pressed: ${pet.name}`);

    // 🔧 Sử dụng shared helpers cho logging
    const summary = PetVariantHelpers.getVariantSummary(pet);
    const hasAvailable = PetVariantHelpers.hasAvailableVariants(pet);

    console.log(`📊 Variant summary:`, summary);
    console.log(`✅ Has available variants: ${hasAvailable}`);

    if (summary.total > 0) {
      const minPrice = PetVariantHelpers.getPetPrice(pet);
      const maxPrice = PetVariantHelpers.getPetMaxPrice(pet);
      console.log(`💰 Price range: ${minPrice} - ${maxPrice}`);
    } else {
      console.log('❌ No variants - using fallback pricing');
    }

    // Navigate với cả pet object và petId để đảm bảo compatibility
    safeNavigate(navigation, 'ProductDetail', {
      pet: pet,
      petId: pet._id
    });
  };

  const handleProductPress = (product: Product) => {
    safeNavigate(navigation, 'ProductDetail', { productId: product._id });
  };

  const getImageUrl = (images: any[] = []) => {
    if (images && images.length > 0) {
      const primaryImage = images.find(img => img.is_primary);
      return primaryImage?.url || images[0]?.url;
    }
    return 'https://via.placeholder.com/150?text=No+Image';
  };

  // 🔧 UPDATED function để lấy giá hiển thị cho pet
  const getPetDisplayPrice = (pet: Pet): { minPrice: number; maxPrice: number; hasRange: boolean } => {
    if (!pet.variants || pet.variants.length === 0) {
      return { minPrice: 0, maxPrice: 0, hasRange: false };
    }

    const minPrice = PetVariantHelpers.getMinPrice(pet);
    const maxPrice = PetVariantHelpers.getMaxPrice(pet);
    const hasRange = PetVariantHelpers.shouldShowPriceRange(pet);

    return { minPrice, maxPrice, hasRange };
  };

  // 🔧 UPDATED: Sử dụng shared PetVariantHelpers với fallback logic
  const formatPetPrice = (pet: Pet): string => {
    console.log(`\n🔍 Formatting price for: ${pet.name}`);

    // 🔧 METHOD 1: Sử dụng shared helper để lấy giá từ variants
    if (pet.variants && pet.variants.length > 0) {
      console.log(`📊 Found ${pet.variants.length} variants`);

      const minPrice = PetVariantHelpers.getPetPrice(pet);
      const maxPrice = PetVariantHelpers.getPetMaxPrice(pet);
      const showFrom = PetVariantHelpers.shouldShowPricePrefix(pet);
      const hasAvailable = PetVariantHelpers.hasAvailableVariants(pet);

      console.log(`💰 Variant pricing:`, {
        minPrice,
        maxPrice,
        showFrom,
        hasAvailable
      });

      if (minPrice > 0) {
        if (showFrom && minPrice !== maxPrice) {
          return `${minPrice.toLocaleString('vi-VN')} - ${maxPrice.toLocaleString('vi-VN')}₫`;
        } else {
          return `${minPrice.toLocaleString('vi-VN')}₫`;
        }
      }
    }

    // 🔧 METHOD 2: Fallback - Kiểm tra pet.price hoặc các field giá khác
    console.log('🔄 No variant price, checking pet price fields...');

    const petPrice = (pet as any).price ||
      (pet as any).selling_price ||
      (pet as any).import_price ||
      (pet as any).base_price;

    console.log(`🔍 Pet price fields:`, {
      price: (pet as any).price,
      selling_price: (pet as any).selling_price,
      import_price: (pet as any).import_price,
      base_price: (pet as any).base_price,
      final: petPrice
    });

    if (petPrice && petPrice > 0) {
      console.log(`💰 Using pet direct price: ${petPrice}₫`);
      return `${petPrice.toLocaleString('vi-VN')}₫`;
    }

    // 🔧 METHOD 3: Default fallback theo type
    console.log('⚡ Using default price by pet type');
    const defaultPrices: { [key: string]: number } = {
      'Chó': 3000000,
      'Dog': 3000000,
      'Mèo': 2000000,
      'Cat': 2000000,
      'Chim': 500000,
      'Bird': 500000,
      'Cá': 200000,
      'Fish': 200000,
      'Hamster': 150000,
      'Thỏ': 800000,
      'Rabbit': 800000
    };

    const defaultPrice = defaultPrices[pet.type] || defaultPrices['Chó'] || 1000000;
    console.log(`💰 Default price for ${pet.type}: ${defaultPrice}₫`);

    return `Từ ${defaultPrice.toLocaleString('vi-VN')}₫`;
  };

  // Category item renderer
  const renderCategoryItem = ({ item }: { item: Category }) => {
    const imageUrl = getImageUrl(item.images);

    return (
      <TouchableOpacity
        style={styles.categoryItem}
        onPress={() => {
          safeNavigate(navigation, 'Breeds', {
            categoryId: item._id,
            categoryName: item.name
          });
        }}
      >
        <View style={styles.categoryImageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.categoryImage}
            onError={(error) => {
              console.log('Category image failed to load:', imageUrl);
            }}
          />
        </View>
        <Text style={styles.categoryText}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  // Empty components
  const PetEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Không có thú cưng nào</Text>
    </View>
  );

  const ProductEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Không có sản phẩm nào</Text>
    </View>
  );

  // Search handlers for HomeSearchBar
  const handleSearchFocus = () => {
    console.log('Search focused');
  };

  const handleSearchBlur = () => {
    console.log('Search blurred');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={styles.safeArea.backgroundColor} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
      >

        {/* Header with Logo */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/pet_shop_logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
            onError={() => {
              console.log('Logo failed to load');
            }}
          />

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('PushNotifications')}
            >
              <Icon name="bell" size={24} color="#2D3748" />
              <NotificationBadge
                style={styles.notificationBadge}
                textStyle={styles.badgeText}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Section */}
        <View style={styles.searchSection}>
          <HomeSearchBar
            placeholder="Tìm kiếm thú cưng, sản phẩm..."
            onSearchFocus={handleSearchFocus}
            onSearchBlur={handleSearchBlur}
          />
        </View>

        {/* Banner */}
        <View style={styles.bannerSection}>
          <BannerSlider
            banners={banners}
            autoSlide={true}
            autoSlideInterval={4000}
            showDots={true}
            height={150}
            borderRadius={16}
          />
        </View>

        {/* Categories Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Danh mục</Text>
          </View>
          {categoriesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.loadingText}>Đang tải danh mục...</Text>
            </View>
          ) : (
            <FlatList
              data={categories}
              renderItem={renderCategoryItem}
              keyExtractor={(item) => item._id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            />
          )}
        </View>

        {/* Pets Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Thú cưng</Text>
            <TouchableOpacity onPress={() => safeNavigate(navigation, 'PetAll')}>
              <Text style={styles.seeAllText}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>

          {petsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.loadingText}>Đang tải thú cưng...</Text>
            </View>
          ) : (
            <PetList
              pets={pets}
              loading={false}
              numColumns={2}
              horizontal={false}
              scrollEnabled={false}
              onPetPress={handlePetPress}
              itemStyle="grid"
              contentContainerStyle={styles.petListContent}
              ListEmptyComponent={PetEmptyComponent}
              // 🔧 UPDATED: Custom price renderer sử dụng shared helpers
              customPriceRenderer={(pet: Pet) => {
                console.log(`\n🎨 Rendering price for: ${pet.name}`);

                const priceString = formatPetPrice(pet);
                const summary = PetVariantHelpers.getVariantSummary(pet);
                const hasAvailable = PetVariantHelpers.hasAvailableVariants(pet);

                console.log(`📝 Final display: "${priceString}"`);
                console.log(`📊 Summary:`, summary);

                // Kiểm tra xem có phải là fallback price không
                const isFallbackPrice = priceString.includes('Từ') && summary.total === 0;
                const isDefaultPrice = summary.total === 0 && !(pet as any).price;

                return (
                  <View style={styles.priceContainer}>
                    <Text style={[
                      styles.priceText,
                      isFallbackPrice && styles.fallbackPriceText
                    ]}>
                      {priceString}
                    </Text>

                    {/* Hiển thị thông tin variants */}
                    {summary.total > 0 && (
                      <View style={styles.variantInfoRow}>
                        <Text style={styles.variantCountText}>
                          {summary.total} biến thể
                        </Text>
                        {summary.available !== summary.total && (
                          <Text style={styles.availableCountText}>
                            ({summary.available} có sẵn)
                          </Text>
                        )}
                        {summary.colors.length > 1 && (
                          <Text style={styles.colorCountText}>
                            • {summary.colors.length} màu
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Label cho giá ước tính */}
                    {summary.total === 0 && isDefaultPrice && (
                      <Text style={styles.estimatedPriceText}>
                        Giá ước tính
                      </Text>
                    )}

                    {/* Hiển thị available status */}
                    {summary.total > 0 && !hasAvailable && (
                      <Text style={styles.unavailableText}>
                        Tạm hết hàng
                      </Text>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* Products Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vật phẩm</Text>
            <TouchableOpacity onPress={() => safeNavigate(navigation, 'ProductAll')}>
              <Text style={styles.seeAllText}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>

          {productsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.loadingText}>Đang tải sản phẩm...</Text>
            </View>
          ) : (
            <ProductList
              products={products}
              loading={false}
              numColumns={1}
              horizontal={true}
              scrollEnabled={true}
              onProductPress={handleProductPress}
              itemStyle="horizontal"
              contentContainerStyle={styles.productListContent}
              showsHorizontalScrollIndicator={false}
              ListEmptyComponent={ProductEmptyComponent}
            />
          )}
        </View>

        {/* Error handling */}
        {error && (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={24} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadInitialData}
            >
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* Floating Chat Support Button */}
      <ChatSupportButton
        variant="floating"
        size="medium"
      />
    </SafeAreaView>
  );
};

// 🔧 UPDATED Styles - cải thiện pricing display
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA'
  },
  container: {
    paddingBottom: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 25,
  },
  logoImage: {
    width: 100,
    height: 40,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Search section
  searchSection: {
    paddingTop: 5,
  },

  // Banner
  bannerContainer: {
    marginHorizontal: 20,
    marginTop: 20
  },
  bannerImage: {
    width: '100%',
    height: 150,
    borderRadius: 16,
    backgroundColor: '#F1F5F9'
  },

  // Sections
  section: {
    marginTop: 24
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748'
  },
  seeAllText: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '600'
  },

  // Categories
  categoryList: {
    paddingHorizontal: 20
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: 20
  },
  categoryImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryImage: {
    width: '90%',
    height: '90%',
    borderRadius: 30
  },
  categoryText: {
    fontSize: 14,
    color: '#4A5568',
    fontWeight: '500'
  },

  // Lists
  petListContent: {
    paddingHorizontal: 20,
  },
  productListContent: {
    paddingHorizontal: 20,
  },

  // 🔧 ENHANCED pricing styles with additional states
  priceContainer: {
    alignItems: 'flex-start',
    marginTop: 8,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626', // Đỏ đậm cho giá thật
  },
  fallbackPriceText: {
    color: '#059669', // Xanh cho giá ước tính
    fontStyle: 'italic',
  },
  variantInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  variantCountText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  availableCountText: {
    fontSize: 11,
    color: '#F59E0B',
    marginLeft: 4,
    fontStyle: 'italic',
  },
  colorCountText: {
    fontSize: 11,
    color: '#8B5CF6',
    marginLeft: 4,
  },
  estimatedPriceText: {
    fontSize: 11,
    color: '#059669',
    marginTop: 2,
    fontStyle: 'italic',
  },
  unavailableText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 2,
    fontWeight: '500',
  },

  // Loading states
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },

  // Empty states
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // Error handling
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    marginHorizontal: 20,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  bannerSection: {
    marginTop: 20,
  },
});

export default HomeScreen;
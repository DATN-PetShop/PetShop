import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// Interface cho banner item
interface BannerItem {
    id: string;
    image: string;
    title?: string;
    subtitle?: string;
    onPress?: () => void;
}

// Interface cho props
interface BannerSliderProps {
    banners: BannerItem[];
    autoSlide?: boolean;
    autoSlideInterval?: number;
    showDots?: boolean;
    height?: number;
    borderRadius?: number;
}

const BannerSlider: React.FC<BannerSliderProps> = ({
    banners,
    autoSlide = true,
    autoSlideInterval = 3000,
    showDots = true,
    height = 150,
    borderRadius = 16,
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const autoSlideTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto slide effect
    useEffect(() => {
        if (autoSlide && banners.length > 1) {
            startAutoSlide();
            return () => stopAutoSlide();
        }
    }, [autoSlide, banners.length, currentIndex]);

    const startAutoSlide = () => {
        stopAutoSlide();
        autoSlideTimerRef.current = setTimeout(() => {
            goToNextSlide();
        }, autoSlideInterval);
    };

    const stopAutoSlide = () => {
        if (autoSlideTimerRef.current) {
            clearTimeout(autoSlideTimerRef.current);
            autoSlideTimerRef.current = null;
        }
    };

    const goToNextSlide = () => {
        const nextIndex = (currentIndex + 1) % banners.length;
        setCurrentIndex(nextIndex);
        flatListRef.current?.scrollToIndex({
            index: nextIndex,
            animated: true,
        });
    };

    const handleScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const newIndex = Math.round(offsetX / screenWidth);
        if (newIndex !== currentIndex && newIndex >= 0 && newIndex < banners.length) {
            setCurrentIndex(newIndex);
        }
    };

    const handleDotPress = (index: number) => {
        setCurrentIndex(index);
        flatListRef.current?.scrollToIndex({
            index,
            animated: true,
        });
    };

    const renderBannerItem = ({ item }: { item: BannerItem }) => (
        <TouchableOpacity
            style={[styles.bannerItem, { width: screenWidth - 40, height }]}
            onPress={item.onPress}
            activeOpacity={0.8}
        >
            <Image
                source={{ uri: item.image }}
                style={[styles.bannerImage, { borderRadius }]}
                resizeMode="cover"
            />

            {/* Text overlay không có background */}
            {(item.title || item.subtitle) && (
                <View style={styles.textOverlay}>
                    {item.title && (
                        <Text style={styles.bannerTitle}>{item.title}</Text>
                    )}
                    {item.subtitle && (
                        <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );

    const renderDots = () => {
        if (!showDots || banners.length <= 1) return null;

        return (
            <View style={styles.dotsContainer}>
                {banners.map((_, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.dot,
                            currentIndex === index ? styles.activeDot : styles.inactiveDot,
                        ]}
                        onPress={() => handleDotPress(index)}
                    />
                ))}
            </View>
        );
    };

    if (!banners || banners.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={banners}
                renderItem={renderBannerItem}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onScrollBeginDrag={stopAutoSlide}
                onScrollEndDrag={startAutoSlide}
                contentContainerStyle={styles.flatListContent}
                decelerationRate="fast"
                snapToInterval={screenWidth - 40}
                snapToAlignment="start"
            />

            {renderDots()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 20,
    },
    flatListContent: {
        alignItems: 'center',
    },
    bannerItem: {
        marginHorizontal: 0,
        position: 'relative',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F1F5F9',
    },
    textOverlay: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        // Bỏ background và padding
    },
    bannerTitle: {
        color: '#240404ff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    bannerSubtitle: {
        color: '#020917ff',
        fontSize: 14,
        lineHeight: 18,
        textShadowColor: 'rgba(0, 0, 0, 0.7)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        gap: 8,
    },
    dot: {
        borderRadius: 6,
    },
    activeDot: {
        width: 20,
        height: 6,
        backgroundColor: '#2563EB',
    },
    inactiveDot: {
        width: 6,
        height: 6,
        backgroundColor: '#CBD5E1',
    },
});

export default BannerSlider;
// PetCareBooking.ts

// Existing interfaces
export interface Service {
    id: string;
    name: string;
    price: number;
    duration: string;
    description: string;
    icon: string;
}

export interface TimeSlot {
    time: string;
    available: boolean;
}

export interface CustomerInfo {
    name: string;
    phone: string;
    email: string;
    notes: string;
}

// ✅ Added PurchasedPetOrderItem interface
export interface PurchasedPetOrderItem {
    order_id: { _id: string };
    pet_id: {
        _id: string;
        name: string;
        image?: string;
    };
    variant_id: {
        _id: string;
    } | null;
}
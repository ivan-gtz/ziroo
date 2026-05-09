import React, { useState, useEffect, ChangeEvent, FormEvent, useMemo, useRef } from 'react';
import { Plus, Edit, Trash2, Image as ImageIcon, List, X, Settings, ChefHat, UtensilsCrossed, Coffee, IceCream, Pizza, Sandwich, Soup, CakeSlice, Beer, Wine, Apple, Carrot, Fish, Beef, Drumstick, Image, Upload, Layout } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { MenuItem, MenuItemVariation, Category, ProductExtra, Banner } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { compressImage } from '../lib/imageUtils';
import { TEXT_LIMITS, sanitizeInput, validateImageFile } from '../lib/securityUtils';

const emptyItem: Omit<MenuItem, 'id'> = {
  name: '',
  description: '',
  price: 0,
  category: '', // Initialized empty, will be set to first category in openModalForNew
  stock: undefined,
  variations: []
};

const emptyCategory: Omit<Category, 'id'> = {
  name: '',
  iconType: 'lucide',
  iconValue: 'ChefHat'
};

// Lucide Icon Map for selection
export const ICON_MAP: Record<string, React.FC<any>> = {
  ChefHat, UtensilsCrossed, Coffee, IceCream, Pizza, Sandwich, Soup,
  CakeSlice, Beer, Wine, Apple, Carrot, Fish, Beef, Drumstick
};

const MenuManagement: React.FC = () => {
  const { t, menuItems, categories, addMenuItem, updateMenuItem, deleteMenuItem, formatCurrency, activeBranch, addCategory, updateCategory, deleteCategory, extras, addProductExtra, updateProductExtra, deleteProductExtra, allSettings, saveBranchSettings } = useAppContext();

  // Item States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Omit<MenuItem, 'id'> & { id?: string }>(emptyItem);
  const [imagePreview, setImagePreview] = useState<string | undefined>(undefined);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Category States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [currentCategoryData, setCurrentCategoryData] = useState<Omit<Category, 'id'>>(emptyCategory);

  // Filter state for Cards
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Extras States
  const [isExtrasLibraryOpen, setIsExtrasLibraryOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<{ id?: string; name: string; price: number } | null>(null);
  const [selectedExtrasIds, setSelectedExtrasIds] = useState<string[]>([]);
  const [openVariationExtrasIndex, setOpenVariationExtrasIndex] = useState<number | null>(null);

  // Image Library State
  const [isImageLibraryOpen, setIsImageLibraryOpen] = useState(false);
  const [imageLibraryTarget, setImageLibraryTarget] = useState<{ type: 'main' | 'variation' | 'category', index?: number } | null>(null);

  // Banner State
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [localBanners, setLocalBanners] = useState<Banner[]>([]);
  const [isBannerSaving, setIsBannerSaving] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  // Function to open banner modal and INITIALIZE state once
  const handleOpenBannerModal = () => {
    if (!activeBranch) return;

    const s = allSettings[activeBranch.id];
    let banners: Banner[] = s?.banners || [];

    // Compat check for legacy bannerImages
    if (banners.length === 0 && s?.bannerImages && s.bannerImages.length > 0) {
      banners = s.bannerImages.map((img, i) => ({
        id: (i.toString() + Math.random()),
        image: img,
        actionType: 'none'
      }));
    }

    // Initialize local state ONLY when button is clicked
    setLocalBanners(JSON.parse(JSON.stringify(banners)));
    setIsBannerModalOpen(true);
  };

  const uniqueImages = useMemo(() => {
    const imgs = new Set<string>();
    menuItems.forEach(item => {
      if (item.image) imgs.add(item.image);
      item.variations?.forEach(v => {
        if (v.image) imgs.add(v.image);
      });
    });
    return Array.from(imgs);
  }, [menuItems]);

  const openImageLibrary = (type: 'main' | 'variation' | 'category', index?: number) => {
    setImageLibraryTarget({ type, index });
    setIsImageLibraryOpen(true);
  };

  const handleImageLibrarySelect = (image: string) => {
    if (!imageLibraryTarget) return;

    if (imageLibraryTarget.type === 'main') {
      setCurrentItem(prev => ({ ...prev, image }));
      setImagePreview(image);
    } else if (imageLibraryTarget.type === 'variation' && typeof imageLibraryTarget.index === 'number') {
      handleVariationChange(imageLibraryTarget.index, 'image', image);
    } else if (imageLibraryTarget.type === 'category') {
      setCurrentCategoryData(prev => ({ ...prev, iconType: 'custom', iconValue: image }));
    }
    setIsImageLibraryOpen(false);
    setImageLibraryTarget(null);
  };

  // Item Handling
  const openModalForNew = () => {
    // Default to first category if available, otherwise empty string (validation should catch)
    const defaultCategory = categories.length > 0 ? categories[0].id : '';
    setCurrentItem({ ...emptyItem, category: defaultCategory });
    setImagePreview(undefined);
    setIsModalOpen(true);
  };

  const openModalForEdit = (item: MenuItem) => {
    setCurrentItem(item);
    setImagePreview(item.image);
    setSelectedExtrasIds(item.extras?.map(e => e.id) || []);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentItem(emptyItem);
    setImagePreview(undefined);
    setSelectedExtrasIds([]);
  };

   const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files[0]) {
       const file = e.target.files[0];
       const validation = validateImageFile(file);
       if (!validation.valid) {
         alert(validation.error);
         e.target.value = '';
         return;
       }
       try {
         const compressedImage = await compressImage(file);
         setCurrentItem(prev => ({ ...prev, image: compressedImage }));
         setImagePreview(compressedImage);
       } catch (error: any) {
         alert(error.message || "Error al cargar la imagen.");
         e.target.value = '';
       }
     }
   };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentItem(prev => ({
      ...prev,
      [name]: (name === 'price' || name === 'stock')
        ? (value === '' ? undefined : parseFloat(value))
        : value
    }));
  };

  const handleComboChange = (field: keyof MenuItem, value: any) => {
    setCurrentItem(prev => ({ ...prev, [field]: value }));
  };

  const toggleComboItem = (itemId: string) => {
    setCurrentItem(prev => {
      const currentComboItems = prev.comboItems || [];
      if (currentComboItems.includes(itemId)) {
        return { ...prev, comboItems: currentComboItems.filter(id => id !== itemId) };
      } else {
        return { ...prev, comboItems: [...currentComboItems, itemId] };
      }
    });
  };

   const handleSubmit = (e: FormEvent) => {
     e.preventDefault();

     // ---> VALIDADOR DE SEGURIDAD PARA COMBOS (Previene Loops y Crashes) <---
     if (currentItem.isCombo) {
       if (!currentItem.mainProductId) {
         alert("Debe seleccionar un Producto Principal (Base) para poder guardar el Combo.");
         return;
       }

       if (currentItem.mainProductId === currentItem.id) {
         alert("Un Combo no puede referenciarse a sí mismo como plato principal (Bucle Infinito).");
         return;
       }

       if (currentItem.comboItems && currentItem.id && currentItem.comboItems.includes(currentItem.id)) {
         alert("Un Combo no puede contenerse a sí mismo como complemento (Bucle Infinito).");
         return;
       }

       // Prevenir que un Combo use a otro Combo
       const isMainCombo = menuItems.find(i => i.id === currentItem.mainProductId)?.isCombo;
       if (isMainCombo) {
         alert("No se permite anidar combos. El plato principal seleccionado es un Combo.");
         return;
       }

       const hasComboComplement = currentItem.comboItems?.some(itemId => 
         menuItems.find(i => i.id === itemId)?.isCombo
       );
       if (hasComboComplement) {
         alert("No se permite anidar combos. Has seleccionado otro Combo como complemento.");
         return;
       }
     }
     // ---> FIN VALIDADOR <---

     const finalItem = {
       ...currentItem,
       name: sanitizeInput(currentItem.name),
       description: sanitizeInput(currentItem.description),
       variations: (currentItem.variations || []).map(v => ({
         ...v,
         name: sanitizeInput(v.name)
       })),
       extras: extras.filter(e => selectedExtrasIds.includes(e.id))
     };
 
     if (currentItem.id) {
       updateMenuItem(finalItem as MenuItem);
     } else {
       addMenuItem(finalItem);
     }
     closeModal();
   };

  const handleDeleteRequest = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      deleteMenuItem(itemToDelete);
      setItemToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };

  // Category Handling
  const handleCategorySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateCategory({ ...editingCategory, ...currentCategoryData });
      setEditingCategory(null);
    } else {
      addCategory(currentCategoryData);
    }
    setCurrentCategoryData(emptyCategory);
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm(t('menu.delete_category_confirm'))) {
      deleteCategory(id);
    }
  };

   const handleCategoryIconUpload = async (e: ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files[0]) {
       const file = e.target.files[0];
       const validation = validateImageFile(file);
       if (!validation.valid) {
         alert(validation.error);
         e.target.value = '';
         return;
       }
       try {
         const base64 = await compressImage(file, 0.7, 200, 200);
         setCurrentCategoryData(prev => ({ ...prev, iconType: 'custom', iconValue: base64 }));
       } catch (error: any) {
         alert(error.message || "Error al procesar el icono.");
       }
     }
   };

  // Banner Handling
  // Banner Handling
  // Banner Handling
   const handleBannerUpload = async (e: ChangeEvent<HTMLInputElement>) => {
     if (!activeBranch || isUploadingBanner) return;
     if (e.target.files && e.target.files[0]) {
       const file = e.target.files[0];
       const validation = validateImageFile(file);
       if (!validation.valid) {
         alert(validation.error);
         e.target.value = '';
         return;
       }
       setIsUploadingBanner(true);
       try {
         const base64 = await compressImage(file, 0.9, 1200, 600);
         const newBanner: Banner = {
           id: Date.now().toString() + Math.random(),
           image: base64,
           actionType: 'none'
         };
         setLocalBanners(prev => [...prev, newBanner]);
       } catch (error: any) {
         alert(error.message || "Error al procesar el banner.");
       } finally {
         setIsUploadingBanner(false);
         e.target.value = ''; // Reset input
       }
     }
   };

  const handleDeleteBanner = (index: number) => {
    if (confirm('¿Eliminar este banner?')) {
      setLocalBanners(prev => {
        const newBanners = [...prev];
        newBanners.splice(index, 1);
        return newBanners;
      });
    }
  };

  const handleBannerUpdate = (index: number, field: keyof Banner, value: any) => {
    setLocalBanners(prev => {
      const newBanners = [...prev];
      if (!newBanners[index]) return prev;

      newBanners[index] = { ...newBanners[index], [field]: value };

      // If switching action type, reset value
      if (field === 'actionType') {
        newBanners[index].actionValue = '';
      }
      return newBanners;
    });
  };

  const handleSaveBanners = async () => {
    if (!activeBranch || isBannerSaving) return;
    setIsBannerSaving(true);

    try {
      const currentSettings = allSettings[activeBranch.id] || { restaurantName: activeBranch.name, currency: 'Bs', socialLinks: {} };

      console.log("Saving banners to Supabase...", localBanners);

      await saveBranchSettings({
        ...currentSettings,
        banners: localBanners,
        bannerImages: undefined // Clear legacy
      });

      console.log("✅ Banners saved successfully!");
      alert("¡Banners guardados con éxito!");
      setIsBannerModalOpen(false);
    } catch (error) {
      console.error("Failed to save banners:", error);
      alert("Error al guardar los banners. Intenta de nuevo.");
    } finally {
      setIsBannerSaving(false);
    }
  };

  // Variation handling
  const handleAddVariation = () => {
    setCurrentItem(prev => ({
      ...prev,
      variations: [...(prev.variations || []), { id: Date.now().toString(), name: '', price: prev.price }]
    }));
  };

  const handleVariationChange = (index: number, field: keyof MenuItemVariation, value: any) => {
    setCurrentItem(prev => {
      const newVariations = [...(prev.variations || [])];
      newVariations[index] = { ...newVariations[index], [field]: value };
      return { ...prev, variations: newVariations };
    });
  };

  const handleRemoveVariation = (index: number) => {
    setCurrentItem(prev => {
      const newVariations = [...(prev.variations || [])];
      newVariations.splice(index, 1);
      return { ...prev, variations: newVariations };
    });
  };

  const handleVariationToggleExtra = (index: number, extra: ProductExtra) => {
    setCurrentItem(prev => {
      const newVariations = [...(prev.variations || [])];
      const variation = newVariations[index];
      const currentExtras = variation.extras || [];
      const exists = currentExtras.some(e => e.id === extra.id);

      let newExtras;
      if (exists) {
        newExtras = currentExtras.filter(e => e.id !== extra.id);
      } else {
        newExtras = [...currentExtras, extra];
      }

      newVariations[index] = { ...variation, extras: newExtras };
      return { ...prev, variations: newVariations };
    });
  };

  // Filtered Items for Cards
  const filteredItems = menuItems.filter(item => {
    if (activeCategory !== 'All' && item.category !== activeCategory) return false;
    return true;
  });

  // Helper to render Category Icon
  const CategoryIconDisplay: React.FC<{ category: Category }> = ({ category }) => {
    if (category.iconType === 'custom') {
      return <img src={category.iconValue} alt={category.name} className="w-6 h-6 object-cover rounded-full" />;
    }
    const IconComponent = ICON_MAP[category.iconValue] || ChefHat;
    return <IconComponent size={24} />;
  };

  if (!activeBranch) return <div>{t('settings.no_branch_selected')}</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('menu.title')}</h1>
        <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto overflow-y-hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          <style>{`
            .overflow-x-auto::-webkit-scrollbar { display: none; }
          `}</style>
          <Button onClick={openModalForNew} className="whitespace-nowrap flex-shrink-0">
            <Plus size={16} className="mr-2" />
            {t('menu.add_item')}
          </Button>
          <Button variant="secondary" onClick={() => setIsExtrasLibraryOpen(true)} className="whitespace-nowrap flex-shrink-0">
            <List size={16} className="mr-2" />
            Extras
          </Button>
          <Button variant="secondary" onClick={handleOpenBannerModal} className="whitespace-nowrap flex-shrink-0">
            <Layout size={16} className="mr-2" />
            Banners
          </Button>
          <Button variant="secondary" onClick={() => setIsCategoryModalOpen(true)} className="whitespace-nowrap flex-shrink-0">
            <Settings size={16} className="mr-2" />
            {t('menu.manage_categories')}
          </Button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory('All')}
          className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${activeCategory === 'All' ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
        >
          <ChefHat size={16} />
          {t('all')}
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 ${activeCategory === cat.id ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
          >
            <CategoryIconDisplay category={cat} />
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu Items Grid: 2 cols mobile, 3 tablet, 4 pc */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {filteredItems.map((item) => {
          const cat = categories.find(c => c.id === item.category);
          return (
            <Card key={item.id} className="flex flex-col h-full">
              <div className="relative h-32 sm:h-48 w-full bg-gray-200 dark:bg-gray-700">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <ImageIcon size={32} />
                  </div>
                )}
                {cat && (
                  <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-full px-2 py-1 text-[10px] sm:text-xs font-bold shadow flex items-center gap-1">
                    <CategoryIconDisplay category={cat} /> {cat.name}
                  </div>
                )}
              </div>
              <div className="p-3 sm:p-4 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight">{item.name}</h3>
                </div>
                <span className="text-sm sm:text-lg font-bold text-primary-600 dark:text-primary-400 mb-2 block">{formatCurrency(item.price)}</span>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4 flex-grow line-clamp-2">{item.description}</p>

                {item.variations && item.variations.length > 0 ? (
                  <div className="mb-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    <p className="font-semibold flex items-center"><List size={14} className="mr-1" /> {item.variations.length} Variations</p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <span className={`text-xs sm:text-sm font-medium ${item.stock != null && item.stock <= 5 ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
                      {t('menu.stock')}: {item.stock != null ? item.stock : t('menu.stock_unlimited')}
                    </span>
                  </div>
                )}

                <div className="flex justify-end space-x-2 mt-auto">
                  <Button variant="secondary" size="sm" onClick={() => openModalForEdit(item)}>
                    <Edit size={14} />
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteRequest(item.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={currentItem.id ? t('menu.edit_item') : t('menu.add_item')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-[70vh] overflow-y-auto p-1 custom-scrollbar">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('menu.item_name')}</label>
               <input
                 type="text"
                 name="name"
                 value={currentItem.name}
                 onChange={handleChange}
                 required
                 maxLength={TEXT_LIMITS.NAME}
                 className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
               />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('menu.description')}</label>
               <textarea
                 name="description"
                 value={currentItem.description}
                 onChange={handleChange}
                 rows={3}
                 maxLength={TEXT_LIMITS.DESCRIPTION}
                 className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
               />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('menu.price')}</label>
                <input
                  type="number"
                  name="price"
                  value={currentItem.price !== undefined && currentItem.price !== null ? currentItem.price : ''}
                  onChange={handleChange}
                  step="0.01"
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('menu.category')}</label>
                <select
                  name="category"
                  value={currentItem.category}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('menu.image')}</label>
                <button
                  type="button"
                  onClick={() => openImageLibrary('main')}
                  className="text-xs text-primary-600 font-bold hover:underline flex items-center gap-1"
                >
                  <ImageIcon size={14} /> Usar de Galería
                </button>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              <p className="mt-1 text-xs text-gray-500">Max 1MB</p>
              {imagePreview && (
                <div className="mt-2">
                  <img src={imagePreview} alt="Preview" className="h-32 w-auto rounded-md object-cover" />
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              {/* Combo Feature Toggle */}
              {(() => {
                const combosUsingThisItem = currentItem.id ? menuItems.filter(mi => 
                  mi.isCombo && 
                  (mi.mainProductId === currentItem.id || (mi.comboItems && mi.comboItems.includes(currentItem.id || '')))
                ) : [];
                const isUsedInCombos = combosUsingThisItem.length > 0;

                return (
                  <div className="flex flex-col gap-1 mb-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isCombo"
                        checked={!!currentItem.isCombo}
                        onChange={(e) => handleComboChange('isCombo', e.target.checked)}
                        disabled={isUsedInCombos}
                        className={`w-4 h-4 rounded ${isUsedInCombos ? 'text-gray-400 opacity-50 cursor-not-allowed' : 'text-primary-600'}`}
                      />
                      <label htmlFor="isCombo" className={`font-bold ${isUsedInCombos ? 'text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>¿Es un Combo?</label>
                    </div>
                    {isUsedInCombos && (
                      <p className="text-xs text-red-500 font-medium">Bloqueado: Este producto ya es componente del Combo "{combosUsingThisItem[0]?.name}".</p>
                    )}
                  </div>
                );
              })()}

              {currentItem.isCombo ? (
                <div className="space-y-4 bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700">
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
                    Configura los componentes del combo. El precio del combo será el que definiste arriba, independientemente de los componentes.
                  </p>

                  {/* Main Product Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Producto Principal (Base)</label>
                    <select
                      value={currentItem.mainProductId || ''}
                      onChange={(e) => {
                        handleComboChange('mainProductId', e.target.value);
                        handleComboChange('mainVariantId', ''); // Reset variant
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm p-2"
                    >
                      <option value="">Selecciona el plato fuerte...</option>
                      {menuItems.filter(i => i.id !== currentItem.id && !i.isCombo).map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Variant Selection (if Main Product has variations) */}
                  {currentItem.mainProductId && (() => {
                    const mainItem = menuItems.find(i => i.id === currentItem.mainProductId);
                    if (mainItem && mainItem.variations && mainItem.variations.length > 0) {
                      return (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Variación del Principal</label>
                          <select
                            value={currentItem.mainVariantId || ''}
                            onChange={(e) => handleComboChange('mainVariantId', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm p-2"
                          >
                            <option value="">Selecciona variación...</option>
                            {mainItem.variations.map(v => (
                              <option key={v.id} value={v.id}>{v.name} ({formatCurrency(v.price || mainItem.price)})</option>
                            ))}
                          </select>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Complements Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Complementos a Elegir (Sopas, Refrescos, etc.)</label>
                    <div className="max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700 space-y-2">
                      {menuItems.filter(i => i.id !== currentItem.id && i.id !== currentItem.mainProductId && !i.isCombo).map(item => {
                        const isItemSelected = (currentItem.comboItems || []).includes(item.id);
                        const hasVariations = item.variations && item.variations.length > 0;

                        return (
                          <div key={item.id} className={`p-2 rounded-lg border transition-all ${isItemSelected ? 'bg-primary-50/50 border-primary-200 dark:bg-primary-900/10' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isItemSelected}
                                onChange={() => toggleComboItem(item.id)}
                                className="rounded text-primary-600 h-4 w-4"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                                {hasVariations ? (
                                  <p className="text-[10px] text-primary-600 font-medium">{item.variations?.length} variaciones disponibles</p>
                                ) : (
                                  <p className="text-[10px] text-gray-400">Sin variaciones</p>
                                )}
                              </div>
                            </label>

                            {/* Show variations preview if selected */}
                            {isItemSelected && hasVariations && (
                              <div className="mt-2 ml-7 pl-3 border-l-2 border-primary-100 dark:border-primary-900 grid grid-cols-1 sm:grid-cols-2 gap-1.5 animate-fade-in">
                                {item.variations?.map(v => (
                                  <div key={v.id} className="flex justify-between items-center text-[10px] bg-white dark:bg-gray-700 p-1.5 rounded border border-gray-100 dark:border-gray-600">
                                    <span className="font-medium text-gray-600 dark:text-gray-300">{v.name}</span>
                                    <span className="text-primary-600 font-bold">{formatCurrency(v.price || item.price)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 italic px-1">El cliente deberá elegir uno de estos componentes al comprar el combo.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-md font-bold text-gray-800 dark:text-gray-200">{t('menu.variations_title')}</h4>
                    <Button type="button" size="sm" onClick={handleAddVariation}><Plus size={14} /> {t('menu.add_variation')}</Button>
                  </div>

                  {(currentItem.variations && currentItem.variations.length > 0) ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                      {currentItem.variations.map((variation, index) => {
                        const isExtrasOpen = openVariationExtrasIndex === index;
                        return (
                          <div key={index} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 transition-all">
                            <div className="flex gap-2 items-start mb-2">
                               <input
                                 type="text"
                                 placeholder={t('menu.variation_name_placeholder')}
                                 value={variation.name}
                                 onChange={(e) => handleVariationChange(index, 'name', e.target.value)}
                                 className="flex-1 min-w-0 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2"
                                 maxLength={TEXT_LIMITS.NAME}
                               />
                              <input
                                type="number"
                                placeholder={t('menu.variation_price')}
                                value={variation.price !== undefined ? variation.price : ''}
                                onChange={(e) => handleVariationChange(index, 'price', parseFloat(e.target.value))}
                                className="w-20 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2"
                              />
                              <input
                                type="number"
                                placeholder={t('menu.variation_stock')}
                                value={variation.stock !== undefined && variation.stock !== null ? variation.stock : ''}
                                onChange={(e) => handleVariationChange(index, 'stock', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                className="w-20 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2"
                              />

                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => setOpenVariationExtrasIndex(isExtrasOpen ? null : index)}
                                  className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600 ${variation.extras && variation.extras.length > 0 ? 'text-primary-600 font-bold' : 'text-gray-400'}`}
                                  title="Gestionar Extras para esta variación"
                                >
                                  <List size={16} />
                                </button>
                                <button type="button" onClick={() => handleRemoveVariation(index)} className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                                  <X size={16} />
                                </button>
                              </div>
                            </div>

                            {/* Image upload for variation */}
                            <div className="flex items-center justify-between gap-2 mt-2">
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-primary-100 dark:hover:bg-primary-900/50 text-primary-700 dark:text-primary-300">
                                  <Upload size={14} />
                                  {variation.image ? 'Cambiar img' : 'Img'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                       if (e.target.files && e.target.files[0]) {
                                         const file = e.target.files[0];
                                         try {
                                           const compressed = await compressImage(file, 0.8, 400, 400);
                                           handleVariationChange(index, 'image', compressed);
                                         } catch (error: any) {
                                           alert(error.message || "Error al cargar la imagen.");
                                           e.target.value = '';
                                         }
                                       }
                                     }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => openImageLibrary('variation', index)}
                                  className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-2 py-1.5 rounded-md flex items-center gap-1 text-xs font-medium transition-colors"
                                  title="Usar imagen existente"
                                >
                                  <ImageIcon size={14} />
                                </button>
                                {variation.image && (
                                  <div className="relative group/img">
                                    <img src={variation.image} alt={variation.name} className="h-10 w-10 rounded-md object-cover border-2 border-primary-500" />
                                    <button
                                      type="button"
                                      onClick={() => handleVariationChange(index, 'image', undefined)}
                                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 opacity-0 group-hover/img:opacity-100 transition-opacity"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {variation.extras && variation.extras.length > 0 && !isExtrasOpen && (
                                <span className="text-[10px] text-primary-600 font-medium bg-primary-50 px-2 py-1 rounded-full">
                                  {variation.extras.length} extras activos
                                </span>
                              )}
                            </div>

                            {/* Extras Panel for Variation */}
                            {isExtrasOpen && (
                              <div className="mt-3 p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 animate-fade-in-down">
                                <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">Asignar Extras Específicos</h5>
                                {(extras?.length || 0) > 0 ? (
                                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                                    {extras.map(extra => {
                                      const isSelected = variation.extras?.some(e => e.id === extra.id);
                                      return (
                                        <label key={extra.id} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer border text-xs ${isSelected ? 'bg-primary-50 border-primary-200 dark:bg-primary-900/20 dark:border-primary-800' : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
                                          <input
                                            type="checkbox"
                                            checked={!!isSelected}
                                            onChange={() => handleVariationToggleExtra(index, extra)}
                                            className="rounded text-primary-600 w-3.5 h-3.5"
                                          />
                                          <span className="truncate flex-1">{extra.name}</span>
                                          <span className="font-bold text-gray-500">+{formatCurrency(extra.price)}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400">No hay extras creados globales.</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <p className="text-xs text-gray-500 italic mt-1">{t('menu.stock_managed_by_variations')}</p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('menu.stock')}</label>
                      <input
                        type="number"
                        name="stock"
                        value={currentItem.stock != null ? currentItem.stock : ''}
                        onChange={handleChange}
                        placeholder={t('menu.stock_unlimited')}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Extras only if not combo */}
            {!currentItem.isCombo && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h4 className="text-md font-bold text-gray-800 dark:text-gray-200 mb-2">Extras Disponibles</h4>
                {(extras?.length || 0) > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 border rounded-md">
                    {(extras || []).map(extra => (
                      <label key={extra.id} className="flex items-center gap-3 p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedExtrasIds.includes(extra.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedExtrasIds([...selectedExtrasIds, extra.id]);
                            else setSelectedExtrasIds(selectedExtrasIds.filter(id => id !== extra.id));
                          }}
                          className="rounded text-primary-600"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{extra.name}</span>
                          <span className="text-xs text-gray-500">+{formatCurrency(extra.price)}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No hay extras creados. Hazlo en la galería de extras primero.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={closeModal}>
              {t('menu.cancel')}</Button>
            <Button type="submit">
              {t('menu.save')}</Button>
          </div>
        </form>
      </Modal>

      {/* CATEGORY MANAGEMENT MODAL */}
      <Modal isOpen={isCategoryModalOpen} onClose={() => { setIsCategoryModalOpen(false); setEditingCategory(null); setCurrentCategoryData(emptyCategory); }} title={t('menu.manage_categories')}>
        <div className="space-y-6">
          {/* Category Form */}
          <form onSubmit={handleCategorySubmit} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">{editingCategory ? t('menu.edit_category') : t('menu.add_category')}</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder={t('menu.category_name')}
                value={currentCategoryData.name}
                onChange={(e) => setCurrentCategoryData({ ...currentCategoryData, name: e.target.value })}
                required
                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 text-sm"
              />

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">{t('menu.select_icon')}</label>

                {/* Standard Icons Grid */}
                <div className="grid grid-cols-6 gap-2">
                  {Object.keys(ICON_MAP).map(iconName => {
                    const IconComp = ICON_MAP[iconName];
                    const isSelected = currentCategoryData.iconType === 'lucide' && currentCategoryData.iconValue === iconName;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setCurrentCategoryData({ ...currentCategoryData, iconType: 'lucide', iconValue: iconName })}
                        className={`p-2 rounded-md flex items-center justify-center transition-all ${isSelected ? 'bg-primary-600 text-white shadow-md' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                      >
                        <IconComp size={20} />
                      </button>
                    );
                  })}
                </div>

                {/* Custom Icon Upload */}
                <div className="flex items-center gap-4 mt-2 border-t pt-2 border-gray-200 dark:border-gray-700">
                  <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">
                    <Upload size={14} /> {t('menu.upload_icon')}
                    <input type="file" accept="image/*" className="hidden" onChange={handleCategoryIconUpload} />
                  </label>
                  {currentCategoryData.iconType === 'custom' && (
                    <div className="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/30 px-3 py-1 rounded-full border border-primary-200 dark:border-primary-800">
                      <img src={currentCategoryData.iconValue} alt="Custom" className="w-6 h-6 rounded-full object-cover" />
                      <span className="text-xs font-bold text-primary-700 dark:text-primary-300">Custom Selected</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingCategory && <Button type="button" size="sm" variant="secondary" onClick={() => { setEditingCategory(null); setCurrentCategoryData(emptyCategory); }}>{t('menu.cancel')}</Button>}
                <Button type="submit" size="sm">{t('menu.save')}</Button>
              </div>
            </div>
          </form>

          {/* Category List */}
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            {categories.map(cat => (
              <div key={cat.id} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400">
                    <CategoryIconDisplay category={cat} />
                  </div>
                  <span className="font-bold text-gray-800 dark:text-gray-200">{cat.name}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingCategory(cat); setCurrentCategoryData({ name: cat.name, iconType: cat.iconType, iconValue: cat.iconValue }); }} className="text-gray-500 hover:text-blue-500">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDeleteCategory(cat.id)} className="text-gray-500 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* EXTRAS LIBRARY MODAL */}
      <Modal isOpen={isExtrasLibraryOpen} onClose={() => setIsExtrasLibraryOpen(false)} title="Biblioteca de Extras">
        <div className="space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingExtra?.id) updateProductExtra(editingExtra as any);
              else addProductExtra(editingExtra as any);
              setEditingExtra(null);
            }}
            className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg border border-primary-100 dark:border-primary-800"
          >
            <h4 className="text-sm font-bold text-primary-800 dark:text-primary-200 mb-3">
              {editingExtra?.id ? 'Editar Extra' : 'Crear Nuevo Extra'}
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre (ej: Doble Queso)"
                value={editingExtra?.name || ''}
                onChange={(e) => setEditingExtra({ ...editingExtra, name: e.target.value, price: editingExtra?.price || 0 })}
                required
                className="flex-1 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm"
              />
              <input
                type="number"
                placeholder="Precio"
                value={editingExtra?.price || ''}
                onChange={(e) => setEditingExtra({ ...editingExtra, name: editingExtra?.name || '', price: parseFloat(e.target.value) || 0 })}
                required
                className="w-24 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm"
              />
              <Button type="submit" size="sm">Guardar</Button>
            </div>
            {editingExtra && (
              <button type="button" onClick={() => setEditingExtra(null)} className="text-xs text-gray-500 mt-2 underline">Cancelar edición</button>
            )}
          </form>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(extras?.length || 0) === 0 && <p className="text-center text-gray-500 text-sm py-4">No hay extras. Crea uno arriba.</p>}
            {(extras || []).map(extra => (
              <div key={extra.id} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                <div>
                  <div className="font-bold text-sm">{extra.name}</div>
                  <div className="text-xs text-primary-600 font-bold">+{formatCurrency(extra.price)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingExtra(extra)} className="text-gray-400 hover:text-blue-500 p-1">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => confirm(`¿Borrar "${extra.name}"?`) && deleteProductExtra(extra.id)} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 italic">Nota: Los extras se pueden asignar a cualquier producto desde su edición.</p>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('menu.delete_title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>{t('menu.cancel')}</Button>
            <Button variant="danger" onClick={handleConfirmDelete}>{t('menu.delete')}</Button>
          </>
        }
      >
        <p className="text-gray-800 dark:text-gray-200">{t('menu.delete_confirm')}</p>
      </Modal>

      {/* IMAGE LIBRARY MODAL */}
      <Modal
        isOpen={isImageLibraryOpen}
        onClose={() => setIsImageLibraryOpen(false)}
        title="Galería de Imágenes"
      >
        <div className="p-1">
          <p className="text-sm text-gray-500 mb-4">Selecciona una imagen utilizada previamente en otros productos:</p>
          {uniqueImages.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
              {uniqueImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => handleImageLibrarySelect(img)}
                  className="relative group aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                >
                  <img src={img} alt={`Gallery ${i}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <ImageIcon size={48} className="mx-auto mb-2 opacity-20" />
              <p>No hay imágenes subidas aún.</p>
            </div>
          )}
          <div className="flex justify-end mt-4 pt-4 border-t dark:border-gray-700">
            <Button variant="secondary" onClick={() => setIsImageLibraryOpen(false)}>Cerrar</Button>
          </div>
        </div>
      </Modal>

      {/* BANNER MANAGEMENT MODAL */}
      <Modal
        isOpen={isBannerModalOpen}
        onClose={() => setIsBannerModalOpen(false)}
        title="Gestión de Banners (Menú Cliente)"
      >
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-200">
            Sube imágenes para mostrar promociones o destacados en la parte superior del Menú Digital. Se mostrarán en carrusel.
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Debug Log */}
            {console.log('Rendering Banners:', localBanners)}


            {Array.isArray(localBanners) && localBanners.map((banner, index) => {
              if (!banner) return null;
              const bannerId = banner.id || `banner-${index}`;
              return (
                <div key={bannerId} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-700">
                  <div className="relative aspect-[3/1] bg-gray-100 dark:bg-gray-900 group">
                    {banner.image ? (
                      <img src={banner.image} alt={`Banner ${index}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400"><ImageIcon size={48} /></div>
                    )}
                    <button
                      onClick={() => handleDeleteBanner(index)}
                      className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-gray-500 uppercase">Acción al hacer clic:</label>
                      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button
                          onClick={() => handleBannerUpdate(index, 'actionType', 'none')}
                          className={`px-3 py-1 rounded text-xs font-bold transition-colors ${banner.actionType === 'none' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Ninguna
                        </button>
                        <button
                          onClick={() => handleBannerUpdate(index, 'actionType', 'link')}
                          className={`px-3 py-1 rounded text-xs font-bold transition-colors ${banner.actionType === 'link' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Link Externo
                        </button>
                        <button
                          onClick={() => handleBannerUpdate(index, 'actionType', 'product')}
                          className={`px-3 py-1 rounded text-xs font-bold transition-colors ${banner.actionType === 'product' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Producto
                        </button>
                      </div>
                    </div>

                    {banner.actionType === 'link' && (
                      <input
                        type="url"
                        placeholder="https://ejemplo.com/promo"
                        value={banner.actionValue || ''}
                        onChange={(e) => handleBannerUpdate(index, 'actionValue', e.target.value)}
                        className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm p-2"
                      />
                    )}

                    {banner.actionType === 'product' && (
                      <select
                        value={banner.actionValue || ''}
                        onChange={(e) => handleBannerUpdate(index, 'actionValue', e.target.value)}
                        className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm p-2"
                      >
                        <option value="">-- Seleccionar Producto --</option>
                        {menuItems && menuItems.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}

            <label className={`border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl aspect-video flex flex-col items-center justify-center transition-colors ${isUploadingBanner ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              {isUploadingBanner ? (
                <>
                  <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-sm font-medium text-gray-500">Procesando Imagen...</span>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-500">Subir Nuevo Banner</span>
                  <span className="text-xs text-gray-400 mt-1">Recomendado: 1200x600px</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                </>
              )}
            </label>
          </div>

          <div className="flex justify-end pt-4 border-t dark:border-gray-700 gap-2">
            <Button variant="secondary" onClick={() => setIsBannerModalOpen(false)} disabled={isBannerSaving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveBanners} loading={isBannerSaving}>
              {isBannerSaving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </div>
      </Modal>
    </div >
  );
};

export default MenuManagement;
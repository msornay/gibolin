import React from "react";
import { Reference } from "../index";

type PrintTemplateProps = {
  references: Reference[];
  categoryOrder: string[];
  isPreview?: boolean;
  onClose?: () => void;
};

export function PrintTemplate({ references, categoryOrder, isPreview, onClose }: PrintTemplateProps) {
  // Group references by category following the saved order
  const groupedReferences = React.useMemo(() => {
    const groups: Record<string, Reference[]> = {};
    
    // Initialize groups in the correct order
    categoryOrder.forEach(category => {
      groups[category] = [];
    });
    
    // Add uncategorized group
    groups['Uncategorized'] = [];

    // Group references
    references.forEach(ref => {
      const category = ref.category || 'Uncategorized';
      if (groups[category]) {
        groups[category].push(ref);
      } else {
        // Category not in saved order, add to end
        groups[category] = [ref];
      }
    });

    // Sort references within each category
    Object.keys(groups).forEach(category => {
      groups[category].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });

    return groups;
  }, [references, categoryOrder]);

  return (
    <div className={`print-content ${isPreview ? 'preview-mode' : ''}`}>
      {isPreview && onClose && (
        <button className="preview-close" onClick={onClose}>
          Close Preview
        </button>
      )}
      <div className="print-header">
        <div className="restaurant-logo">
          <div className="logo-icon">🍷</div>
          <h1>Château de la Maison</h1>
          <div className="restaurant-subtitle">Fine Dining • Wine Selection</div>
        </div>
        <h2 className="menu-title">Wine Menu</h2>
      </div>

      {/* Categories */}
      {categoryOrder.map(category => {
        const categoryRefs = groupedReferences[category];
        if (!categoryRefs || categoryRefs.length === 0) return null;

        return (
          <div key={category} className="category-section page-break-avoid">
            <h2 className="category-title">{category}</h2>
            <div className="wine-list">
              {categoryRefs.map(ref => (
                <div key={ref.sqid} className="wine-item">
                  <div className="wine-details">
                    <div className="wine-name">{ref.name}</div>
                    <div className="wine-info">
                      {ref.domain && <span className="domain">{ref.domain}</span>}
                      {ref.vintage && <span className="vintage">{ref.vintage}</span>}
                    </div>
                  </div>
                  <div className="wine-price">€0</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Uncategorized references */}
      {groupedReferences['Uncategorized'] && groupedReferences['Uncategorized'].length > 0 && (
        <div className="category-section page-break-avoid">
          <h2 className="category-title">Other Selections</h2>
          <div className="wine-list">
            {groupedReferences['Uncategorized'].map(ref => (
              <div key={ref.sqid} className="wine-item">
                <div className="wine-details">
                  <div className="wine-name">{ref.name}</div>
                  <div className="wine-info">
                    {ref.domain && <span className="domain">{ref.domain}</span>}
                    {ref.vintage && <span className="vintage">{ref.vintage}</span>}
                  </div>
                </div>
                <div className="wine-price">€0</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
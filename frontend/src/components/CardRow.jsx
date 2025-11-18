// 文件路径: frontend/src/components/CardRow.jsx
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import Card from './Card';

const CardRow = ({ id, title, cards }) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <SortableContext id={id} items={cards} strategy={horizontalListSortingStrategy}>
      <div ref={setNodeRef} className={`card-row ${isOver ? 'over' : ''}`}>
        <span className="card-row-title">{title}</span>
        {cards.map(card => (
          <Card key={card.id} card={card} />
        ))}
      </div>
    </SortableContext>
  );
};

export default CardRow;
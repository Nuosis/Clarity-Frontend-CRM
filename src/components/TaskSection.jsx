import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import CheckboxSvg from './CheckboxSvg';

const TaskSection = ({ title, tasks, droppableId, onTaskComplete, onTaskClick }) => (
  <div className="mb-8">
    <h3 className="text-lg font-semibold mb-4">{title}</h3>
    <Droppable droppableId={droppableId}>
      {(provided) => (
        <div
          {...provided.droppableProps}
          ref={provided.innerRef}
          className="bg-gray-50 rounded-lg p-4 min-h-[100px]"
        >
          {tasks.map((task, index) => (
            <Draggable key={task.recordId} draggableId={task.recordId} index={index}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  className="bg-white p-4 mb-2 rounded shadow-sm flex items-center gap-4"
                >
                  <CheckboxSvg
                    checked={task.fieldData.f_completed === 1}
                    onChange={onTaskComplete}
                    task={task}
                  />
                  <span 
                    className={`flex-grow cursor-pointer ${task.fieldData.f_completed === 1 ? 'line-through text-gray-400' : ''}`}
                    onClick={() => onTaskClick(task)}
                  >
                    {task.fieldData.task}
                  </span>
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  </div>
);

export default TaskSection;

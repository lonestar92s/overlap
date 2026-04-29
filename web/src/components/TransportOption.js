import React from 'react';
import { FaPlane, FaCar, FaSubway, FaWalking } from 'react-icons/fa';
import { MdTrain, MdDirectionsBus, MdTram } from 'react-icons/md';
import { TbTrainFilled } from 'react-icons/tb';

const TransportOption = ({ option, isSelected, onSelect }) => {
    const getIcon = () => {
        switch (option.type) {
            case 'flight':
                return <FaPlane size={20} />;
            case 'driving':
                return <FaCar size={20} />;
            case 'walking':
                return <FaWalking size={20} />;
            case 'rail':
                return <TbTrainFilled size={20} />;
            case 'transit':
                // Show appropriate transit icons based on available modes
                if (option.transitModes) {
                    return (
                        <div className="flex gap-1">
                            {option.transitModes.includes('train') && <MdTrain size={20} />}
                            {option.transitModes.includes('subway') && <FaSubway size={20} />}
                            {option.transitModes.includes('bus') && <MdDirectionsBus size={20} />}
                            {option.transitModes.includes('tram') && <MdTram size={20} />}
                        </div>
                    );
                }
                return <FaSubway size={20} />;
            default:
                return null;
        }
    };

    const getColor = () => {
        switch (option.type) {
            case 'flight':
                return 'bg-orange-100 hover:bg-orange-200';
            case 'driving':
                return 'bg-green-100 hover:bg-green-200';
            case 'walking':
                return 'bg-blue-100 hover:bg-blue-200';
            case 'rail':
                return 'bg-indigo-100 hover:bg-indigo-200';
            case 'transit':
                return 'bg-purple-100 hover:bg-purple-200';
            default:
                return 'bg-gray-100 hover:bg-gray-200';
        }
    };

    return (
        <div
            className={`p-4 rounded-lg cursor-pointer transition-all ${getColor()} ${
                isSelected ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={onSelect}
        >
            <div className="flex items-center gap-3">
                <div className="text-gray-700">{getIcon()}</div>
                <div className="flex-1">
                    <div className="font-medium text-gray-900">
                        {option.type === 'rail' ? 'Intercity Rail' : option.type.charAt(0).toUpperCase() + option.type.slice(1)}
                    </div>
                    <div className="text-sm text-gray-600">
                        {option.duration} • {option.distance}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{option.details}</div>
                    {option.price && (
                        <div className="text-sm font-medium text-gray-900 mt-1">
                            {option.price}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransportOption; 
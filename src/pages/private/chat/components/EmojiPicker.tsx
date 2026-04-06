import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/** Emoji data with searchable Vietnamese keywords */
const EMOJI_DATA: { emoji: string; keywords: string }[] = [
  { emoji: '😀', keywords: 'cười vui vẻ hạnh phúc' },
  { emoji: '😃', keywords: 'cười vui mắt to' },
  { emoji: '😄', keywords: 'cười tươi hạnh phúc' },
  { emoji: '😁', keywords: 'cười răng vui' },
  { emoji: '😆', keywords: 'cười to lăn lộn' },
  { emoji: '😅', keywords: 'cười ngại xấu hổ mồ hôi' },
  { emoji: '🤣', keywords: 'cười lăn lộn bò' },
  { emoji: '😂', keywords: 'cười khóc nước mắt hài' },
  { emoji: '🙂', keywords: 'mỉm cười nhẹ nhàng' },
  { emoji: '😊', keywords: 'cười ngại dễ thương mắt híp' },
  { emoji: '😇', keywords: 'thiên thần ngoan hiền' },
  { emoji: '🥰', keywords: 'yêu tim trái tim dễ thương' },
  { emoji: '😍', keywords: 'mắt tim yêu thích' },
  { emoji: '🤩', keywords: 'ngôi sao mắt sao thích' },
  { emoji: '😘', keywords: 'hôn gió tình yêu' },
  { emoji: '😗', keywords: 'hôn nhẹ' },
  { emoji: '😋', keywords: 'ngon miệng liếm môi' },
  { emoji: '😛', keywords: 'thè lưỡi trêu đùa' },
  { emoji: '😜', keywords: 'nhắm mắt thè lưỡi tinh nghịch' },
  { emoji: '🤪', keywords: 'điên ngốc vui vẻ' },
  { emoji: '😎', keywords: 'ngầu kính mát cool' },
  { emoji: '🤗', keywords: 'ôm hug thân thiện' },
  { emoji: '🤔', keywords: 'suy nghĩ tư duy' },
  { emoji: '🫣', keywords: 'nhìn trộm ngại' },
  { emoji: '🤭', keywords: 'ché miệng cười ngại' },
  { emoji: '😐', keywords: 'mặt đơ thẳng thắn' },
  { emoji: '😑', keywords: 'mặt tẻ chán' },
  { emoji: '😶', keywords: 'im lặng không nói' },
  { emoji: '🙄', keywords: 'trợn mắt chán ghét' },
  { emoji: '😏', keywords: 'mỉm cười tinh quái' },
  { emoji: '😣', keywords: 'căng thẳng khó chịu' },
  { emoji: '😥', keywords: 'buồn lo lắng mồ hôi' },
  { emoji: '😮', keywords: 'ngạc nhiên há miệng' },
  { emoji: '🤐', keywords: 'khóa miệng im lặng bí mật' },
  { emoji: '😯', keywords: 'ngạc nhiên sốc mở miệng' },
  { emoji: '😪', keywords: 'buồn ngủ mệt mỏi' },
  { emoji: '😫', keywords: 'kiệt sức mệt' },
  { emoji: '🥱', keywords: 'ngáp buồn ngủ chán' },
  { emoji: '😴', keywords: 'ngủ say z z z' },
  { emoji: '🤤', keywords: 'chảy dãi thèm ngon' },
  { emoji: '😌', keywords: 'nhẹ nhàng bình yên hài lòng' },
  { emoji: '😷', keywords: 'bệnh khẩu trang ốm' },
  { emoji: '🤒', keywords: 'ốm sốt bệnh' },
  { emoji: '🤧', keywords: 'hắt hơi cảm lạnh bệnh' },
  { emoji: '🥺', keywords: 'xin lỗi cầu xin mắt to' },
  { emoji: '😢', keywords: 'khóc buồn nước mắt' },
  { emoji: '😭', keywords: 'khóc to buồn đau lòng' },
  { emoji: '😤', keywords: 'tức giận phản đối' },
  { emoji: '😠', keywords: 'tức giận bực bội' },
  { emoji: '😡', keywords: 'tức giận điên' },
  { emoji: '🤯', keywords: 'nổ đầu sốc ngạc nhiên' },
  { emoji: '😳', keywords: 'đỏ mặt xấu hổ sốc' },
  { emoji: '🥵', keywords: 'nóng bức mệt' },
  { emoji: '🥶', keywords: 'lạnh rét' },
  { emoji: '😱', keywords: 'la hét sợ hãi kinh hoàng' },
  { emoji: '😨', keywords: 'sợ hãi lo lắng hoảng loạn' },
  { emoji: '😰', keywords: 'lo âu mồ hôi sợ' },
  { emoji: '😓', keywords: 'mồ hôi khổ sở buồn' },
  { emoji: '🫡', keywords: 'chào kính đồng ý' },
  { emoji: '👍', keywords: 'tốt đồng ý like thích' },
  { emoji: '👎', keywords: 'không tệ dislike' },
  { emoji: '👌', keywords: 'tốt ok hoàn hảo' },
  { emoji: '✌️', keywords: 'chiến thắng hòa bình hai' },
  { emoji: '🤞', keywords: 'may mắn chéo ngón' },
  { emoji: '🤟', keywords: 'yêu tay rock' },
  { emoji: '🤘', keywords: 'rock metal tay' },
  { emoji: '👋', keywords: 'vẫy tay chào' },
  { emoji: '🤚', keywords: 'dừng lại tay' },
  { emoji: '✋', keywords: 'dừng tay năm' },
  { emoji: '👏', keywords: 'vỗ tay tán thưởng' },
  { emoji: '🙌', keywords: 'giơ tay cổ vũ' },
  { emoji: '🤝', keywords: 'bắt tay đồng ý hợp tác' },
  { emoji: '🙏', keywords: 'cầu nguyện xin lỗi cảm ơn' },
  { emoji: '💪', keywords: 'cơ bắp mạnh mẽ' },
  { emoji: '🫶', keywords: 'tim tay yêu' },
  { emoji: '❤️', keywords: 'tim đỏ yêu tình yêu' },
  { emoji: '🧡', keywords: 'tim cam' },
  { emoji: '💛', keywords: 'tim vàng' },
  { emoji: '💚', keywords: 'tim xanh lá' },
  { emoji: '💙', keywords: 'tim xanh dương' },
  { emoji: '💜', keywords: 'tim tím' },
  { emoji: '🖤', keywords: 'tim đen' },
  { emoji: '🤍', keywords: 'tim trắng' },
  { emoji: '💯', keywords: 'trăm điểm hoàn hảo' },
  { emoji: '💥', keywords: 'nổ bùng nổ' },
  { emoji: '🔥', keywords: 'lửa hot nóng' },
  { emoji: '⭐', keywords: 'sao ngôi sao' },
  { emoji: '🌟', keywords: 'sao sáng tỏa' },
  { emoji: '✨', keywords: 'lấp lánh sao nhỏ' },
];

const EMOJI_LIST = EMOJI_DATA.map((d) => d.emoji);

interface EmojiPickerProps {
  isOpen: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ isOpen, onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = search.trim()
    ? EMOJI_DATA.filter(
        (d) => d.keywords.includes(search.toLowerCase()) || d.emoji.includes(search)
      ).map((d) => d.emoji)
    : EMOJI_LIST;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={onClose} />
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 z-40 w-[300px] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
          >
            <div className="p-2 border-b border-gray-50">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm emoji..."
                className="w-full px-2.5 py-1.5 text-[12px] bg-gray-50 rounded-lg outline-none focus:bg-white border border-transparent focus:border-gray-200 transition-colors"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-8 gap-0.5 p-2 max-h-[200px] overflow-y-auto">
              {filtered.length > 0 ? (
                filtered.map((emoji, idx) => (
                  <button
                    key={`${emoji}_${idx}`}
                    onClick={() => onSelect(emoji)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[18px] transition-colors"
                  >
                    {emoji}
                  </button>
                ))
              ) : (
                <p className="col-span-8 text-center text-[12px] text-gray-400 py-3">
                  Không tìm thấy emoji
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

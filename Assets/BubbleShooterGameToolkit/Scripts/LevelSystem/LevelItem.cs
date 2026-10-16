// // ©2015 - 2024 Candy Smith
// // All rights reserved
// // Redistribution of this software is strictly not allowed.
// // Copy of this software can be obtained from unity asset store only.
// // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// // FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
// // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// // THE SOFTWARE.

#region

using System;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Covers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Hidden;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels;
using BubbleShooterGameToolkit.Scripts.Utils;
using UnityEngine;
using UnityEngine.UIElements;

#endregion

namespace BubbleShooterGameToolkit.Scripts.LevelSystem
{
    [Serializable]
    public struct LevelItemElement
    {
        public GameObject Prefab;
        public Sprite sprite;
        public SpriteStruct[] spriteStructs;
        public Quaternion rotation;
        
        public EBrushType brushType;

        public LevelItemElement(SpriteStruct[] sprites, GameObject prefab, EBrushType brushType = EBrushType.Apply)
        {
            spriteStructs = sprites;
            Prefab = prefab;
            rotation = Quaternion.identity;
            sprite = null;
            this.brushType = brushType;
        }

        public VisualElement GetImages(float size)
        {
            if (sprite != null)
            {
                Image image = new Image();
                image.image = sprite.texture;
                image.style.position = Position.Absolute;
                image.style.color = Color.clear;
                image.style.width = size;
                image.style.height = size;
                var visualElement = image;
                return visualElement;
            }
            
            if (spriteStructs != null)
            {
                return Prefab.SpritesToElement(spriteStructs, rotation, size);
            }

            return null;
        }

        /// check the brush has a value
        public bool IsEmpty => Prefab == null;
        
        public bool IsRemoveBlock => brushType == EBrushType.RemoveBlock;
        public bool IsRemoveLayerBrush => brushType == EBrushType.RemoveLayer;
    }

    public enum EBrushType 
    {
        Apply,
        RemoveLayer,
        RemoveBlock
    }

    [Serializable]
    public class LevelItem
    {
        public LevelItemElement levelElement;
        public LevelItemElement cover;
        public LevelItemElement hidden;
        public LevelItemElement label;
        public LevelItemElement holding;
        
        public LevelItem(LevelItemElement element)
        {
            levelElement = element;
        }

        public LevelItem()
        {
        }

        public bool IsEmpty => levelElement.IsEmpty && cover.IsEmpty && hidden.IsEmpty && label.IsEmpty && holding.IsEmpty;

        public LevelItemElement[] GetElements()
        {
            return new[] {levelElement, cover, hidden, label, holding};
        }

        public void Clear()
        {
            levelElement = new LevelItemElement();
            cover = new LevelItemElement();
            hidden = new LevelItemElement();
            label = new LevelItemElement();
            holding = new LevelItemElement();
        }

        public void Apply(LevelItemElement brush)
        {
            if (!brush.IsEmpty)
            {
                if (brush.Prefab.GetComponent<Cover>())
                {
                    cover = brush;
                }
                else if (brush.Prefab.GetComponent<LabelItem>())
                {
                    label = brush;
                }
                else if (brush.Prefab.GetComponent<Hidden>())
                {
                    hidden = brush;
                }
                else if (brush.Prefab.GetComponent<Holder>())
                {
                    holding = brush;
                }
                else
                {
                    levelElement = brush;
                }
            }
            else
            {
                Clear();
            }
        }

        public void RemoveOneLayer()
        {
            if (!holding.IsEmpty)
                holding = new LevelItemElement();
            else if (!label.IsEmpty)
                label = new LevelItemElement();
            else if (!hidden.IsEmpty)
                hidden = new LevelItemElement();
            else if (!cover.IsEmpty)
                cover = new LevelItemElement();
            else
                levelElement = new LevelItemElement();
        }
    }
}
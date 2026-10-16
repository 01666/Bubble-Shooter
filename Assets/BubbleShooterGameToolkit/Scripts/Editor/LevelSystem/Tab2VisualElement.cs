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

using System;
using System.Collections.Generic;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;

namespace BubbleShooterGameToolkit.Scripts.Editor.LevelSystem
{
    public class Tab2VisualElement : VisualElement
    {
        private SerializedObject levelSerializedObject;
        private bool showSection1 = true;
        private float squareSize = 40;
        private LevelItemElement brush;
        private List<LevelItemElement> itemButtons;
        private VisualElement previousButton;
        private VisualElement previousFieldButton;
        private readonly Level level;
        private bool mouseIsDown;
        private bool foldRandomize;
        private float squareRandomize;
        public Action OnFieldChanged;
        private VisualElement levelDesignFoldout;

        public Tab2VisualElement(SerializedObject levelSerializedObject, Level level, List<LevelItemElement> itemButtons)
        {
            this.levelSerializedObject = levelSerializedObject;
            this.level = level;
            this.itemButtons = itemButtons;
            brush = default;
            AddToClassList("tab2-visual-element");
            DrawTab2();
        }

        private void DrawTab2()
        {
            this.Clear();

            var container = new VisualElement();

            var gameItemsFoldout = new Foldout
            {
                text = "Game items",
                value = showSection1
            };
            gameItemsFoldout.RegisterValueChangedCallback(e => showSection1 = e.newValue);
            container.Add(DrawPallete());
            container.Add(CreateSeparator());
            levelDesignFoldout = new VisualElement();
            levelDesignFoldout.style.marginTop = 10;
            levelDesignFoldout.style.marginLeft = 20;

            levelDesignFoldout.Add(DrawField());
            container.Add(levelDesignFoldout);
            var spaceElement = new VisualElement { style = { height = 10 } };
            container.Add(spaceElement);

            var buttonRow = new VisualElement
            {
                style =
                {
                    flexDirection = FlexDirection.Row,
                    justifyContent = Justify.SpaceBetween
                }
            };

            buttonRow.Add(new Button(AddSquares) { text = "Add 10 squares" });
            buttonRow.Add(new Button(RemoveSquares) { text = "Remove 10 squares" });

            container.Add(buttonRow);
            container.Add(spaceElement);

            this.Add(container);
        }

        VisualElement DrawPallete()
        {
            var root = new VisualElement
            {
                style =
                {
                    flexDirection = FlexDirection.Row,
                    flexWrap = Wrap.Wrap,
                    width = squareSize * 12,
                    alignItems = Align.FlexStart
                }
            };
            root.Add(DrawClearButton());
            root.Add(FillButton());
            root.Add(RemoveLayerButton());
            root.Add(AllClearButton());
            
            VisualElement buttons = new VisualElement
            {
                style =
                {
                    flexDirection = FlexDirection.Row,
                    flexWrap = Wrap.Wrap,
                    alignItems = Align.FlexStart
                }
            };
            int totalItems = itemButtons.Count;

            for (int i = 0; i < totalItems; i++)
            {
                var gameObject = itemButtons[i].Prefab;
                if(gameObject != null && !gameObject.name.Contains("_"))
                    buttons.Add(DrawPalleteButton(i));
            }

            root.Add(buttons);
            return root;

            VisualElement FillButton()
            {
                var fillButton = DrawButton("FILL", squareSize, evt =>
                {
                    foreach (var levelBlock in level.Blocks)
                    {
                        if (levelBlock.IsEmpty)
                        {
                            levelBlock.Apply(itemButtons[0]);
                        }
                    }
                    Reload();
                });
                return fillButton;
            }

            VisualElement AllClearButton()
            {
                var containerForClearButton = new VisualElement 
                {
                    style = 
                    {
                        flexGrow = 1,
                        flexDirection = FlexDirection.Row,
                        justifyContent = Justify.FlexEnd,
                        alignItems = Align.FlexEnd,
                    }
                };
                var clearButton = DrawButton("CLEAR", squareSize, evt =>
                {
                    foreach (var levelBlock in level.Blocks)
                    {
                        levelBlock.Clear();
                    }
                    level.randomBallColors = new bool[6] { true, true, true, true, false, false };

                    Reload();
                });
                clearButton.style.width = squareSize * 1.5f;
                clearButton.style.alignSelf = Align.FlexEnd;
                containerForClearButton.Add(clearButton);
                return containerForClearButton;
            }
        }

        private VisualElement RemoveLayerButton()
        {
            VisualElement button = null;
            button = DrawButton("-1", squareSize, evt =>
            {
                brush = default;
                brush.brushType = EBrushType.RemoveLayer;
                button.style.backgroundColor = Color.gray;
                if (previousButton != null  && previousButton != button)
                    previousButton.style.backgroundColor = new Color(0.3f, 0.3f, 0.3f);
                previousButton = button;
            });

            return button;
        }

        public void Reload()
        {
            levelDesignFoldout.Clear();
            levelDesignFoldout.Add(DrawField());
        }
        
        VisualElement DrawPalleteButton(int index)
        {
            VisualElement button = null;
            button = DrawButton("", squareSize, evt =>
            {
                if (previousButton != null && previousButton != button)
                    previousButton.style.backgroundColor = new Color(0.3f, 0.3f, 0.3f);
                previousButton = button;
                brush = itemButtons[index];
                button.style.backgroundColor = itemButtons[index].IsEmpty ? new Color(0.22f, 0.22f, 0.22f) : Color.gray;
            });

            if (!itemButtons[index].IsEmpty)
                button.Add(DrawTexture(itemButtons[index], squareSize));
            button.tooltip = itemButtons[index].Prefab.name;
            return button;
        }

        VisualElement DrawClearButton()
        {
            VisualElement button = null;
            button = DrawButton("X", squareSize, evt =>
            {
                brush = default;
                brush.brushType = EBrushType.RemoveBlock;
                button.style.backgroundColor = Color.gray;
                if (previousButton != null  && previousButton != button)
                    previousButton.style.backgroundColor = new Color(0.3f, 0.3f, 0.3f);
                previousButton = button;
            });

            return button;
        }

        private VisualElement DrawButton(string s, float size, Action<ClickEvent> clickAction)
        {
            var button = new VisualElement();
            button.style.width = size;
            button.style.height = size;
            button.style.backgroundColor = new Color(0.3f, 0.3f, 0.3f);
            button.style.marginLeft = 2;
            button.style.marginBottom = 2;
            if(s != "")
            {
                Label label = new Label(s)
                {
                    style =
                    {
                        flexGrow = 1,
                        alignSelf = Align.Center,
                        unityTextAlign = TextAnchor.MiddleCenter,
                        fontSize = 13
                    }
                };
                button.Add(label);
            }

            button.RegisterCallback<ClickEvent>(evt =>
            {
                clickAction?.Invoke(evt);
            });
            return button;
        }

        private VisualElement DrawField()
        {
            var scrollView = new VisualElement();
            int sizeX = level.sizeX;
            int sizeY = level.sizeY;
            if (level.IsEmpty())
                level.Clear();
            
            scrollView.RegisterCallback<MouseDownEvent>(evt =>
            {
                mouseIsDown = evt.button == 0;
            });
            scrollView.RegisterCallback<MouseUpEvent>(evt =>
            {
                mouseIsDown = false;
                Save();
            });
            scrollView.RegisterCallback<FocusOutEvent>(evt =>
            {
                mouseIsDown = false;
                Save();
            });
            
            scrollView.RegisterCallback<MouseLeaveEvent>(evt =>
            {
                mouseIsDown = false;
                Save();
            });
            for (int y = 0; y < sizeY; y++)
            {
                VisualElement row = new VisualElement { style = { flexDirection = FlexDirection.Row } };

                int length = sizeX;
                if (y % 2 == 0)
                {
                    row.Add(new VisualElement { style = { width = 20 } });
                    length = sizeX-1;
                }
                for (int x = 0; x < length; x++)
                {
                    var drawFieldButton = DrawFieldButton(x, y);
                    if (x == 4 && y == 4)
                    {
                        var index = y * level.sizeX + x;
                        if (level.levelType == ELevelTypes.Rotating)
                        {
                            ApplyBrush(drawFieldButton, index, itemButtons.Find(i => i.Prefab.name == "_RotatingBall"));
                            if(level.Blocks[index].hidden.IsEmpty)
                                ApplyBrush(drawFieldButton, index, itemButtons.Find(i => i.Prefab.name == "Carrot"));

                            drawFieldButton.style.backgroundColor = Color.blue;
                        }
                        else
                        {
                            if(level.Blocks[index].levelElement.Prefab != null && level.Blocks[index].levelElement.Prefab?.name == "_RotatingBall")
                            {
                                var levelItemElement = new LevelItemElement();
                                levelItemElement.brushType = EBrushType.RemoveBlock;
                                ApplyBrush(drawFieldButton, index, levelItemElement);
                            }

                            drawFieldButton.style.backgroundColor = new Color(0.3f, 0.3f, 0.3f);
                        }
                    }
                    row.Add(drawFieldButton);
                }

                scrollView.Add(row);
            }

            return scrollView;
        }

        private void Save()
        {
            OnFieldChanged?.Invoke();
        }

        private VisualElement DrawFieldButton(int x, int y)
        {
            var index = y * level.sizeX + x;

            var button = DrawButton("", squareSize, null);

            button.RegisterCallback<MouseDownEvent>(evt =>
            {
                if(evt.button == 0)
                {
                    ApplyBrush(button, index, brush);
                }
            });

            button.RegisterCallback<MouseUpEvent>(evt =>
            {
                if (evt.button == 0 && brush.brushType == EBrushType.RemoveLayer)
                {
                    ApplyBrushRemoveLayer(button, index);
                }

                Save();
            });
            
            button.RegisterCallback<MouseOverEvent>(evt =>
            {
                if (mouseIsDown) // Only apply brush if mouse is down
                {
                    ApplyBrush(button, index, brush);
                }
            });

            var levelBlock = level.Blocks[index];

            if (levelBlock != null)
            {
                button.Add(DrawTextures(levelBlock));
            }

            return button;
        }

        private void ApplyBrush(VisualElement button, int index, LevelItemElement brushElement)
        {
            var levelBlock = level.Blocks[index];
            if (brushElement.IsRemoveBlock)
            {
                levelBlock.Clear();
                button.Clear();
            }
            else if (brushElement is { IsRemoveLayerBrush: false, IsEmpty: false })
            {
                levelBlock.Apply(brushElement);
            }

            // Refresh the UI
            button.Add(DrawTextures(levelBlock));
            if(button.childCount > 2)
                button.RemoveAt(0);
        }

        private void ApplyBrushRemoveLayer(VisualElement button, int index)
        {
            var levelBlock = level.Blocks[index];
            levelBlock.RemoveOneLayer();
            button.Clear();
            button.Add(DrawTextures(levelBlock));
            if (button.childCount > 2)
            {
                button.RemoveAt(0);
            }
        }

        private VisualElement DrawTextures(LevelItem levelItem)
        {
            var s = squareSize;
            var imageStack = new VisualElement();
            imageStack.Add(DrawTexture(levelItem.cover, s));
            s = levelItem.cover.IsEmpty ? s : s / 1.2f;
            imageStack.Add(DrawTexture(levelItem.levelElement, s));
            s = levelItem.levelElement.IsEmpty ? s : s / 1.2f;
            imageStack.Add(DrawTexture(levelItem.hidden, s));
            imageStack.Add(DrawTexture(levelItem.label, s));
            imageStack.Add(DrawTexture(levelItem.holding, s));
            return imageStack;
        }

        private VisualElement DrawTexture(LevelItemElement levelItemElement, float size)
        {
            if(levelItemElement.IsEmpty) return null;
            return levelItemElement.GetImages(size);
        }
        
        VisualElement CreateSeparator()
        {
            VisualElement separator = new VisualElement();
            separator.style.height = 1;  // Set the height to 1px
            separator.style.backgroundColor = new Color(0.7f, 0.7f, 0.7f);  // Set the background color to grey
            return separator;
        }
        
        private void AddSquares()
        {
            var blocksLength = level.Length + 100;
            level.Resize(blocksLength);
            level.sizeY += 10;
            Reload();
            Save();
        }

        private void RemoveSquares()
        {
            var blocksLength = level.Length - 100;
            level.Resize(blocksLength);
            level.sizeY -= 10;
            Reload();
            Save();
        }
    }
}
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

using System.Collections.Generic;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEngine;
using UnityEngine.UIElements;

namespace BubbleShooterGameToolkit.Scripts.Utils
{
    public static class ImageUtils
    {
        public static VisualElement GetElementFromPrefab(this GameObject prefab, int size)
        {
            var elementFromPrefab = prefab.SpritesToElement(prefab.GetSprites().ToArray(), Quaternion.identity, size);
            VisualElement imageStack = new VisualElement();
            imageStack.Add(elementFromPrefab);
            imageStack.style.width = size;
            imageStack.style.height = size;
            return imageStack;
        }

        public static List<SpriteStruct> GetSprites(this GameObject asset)
        {
            SpriteRenderer[] spriteRenderers = asset.GetComponentsInChildren<SpriteRenderer>().Where(i=>i.enabled).OrderBy(sr => sr.sortingOrder).ToArray();
            Bounds localBounds = spriteRenderers[0].bounds;
            foreach (SpriteRenderer spriteRenderer in spriteRenderers)
            {
                localBounds.Encapsulate(spriteRenderer.bounds);
            }
            List<SpriteStruct> spriteStructs = new List<SpriteStruct>();
            foreach (var spriteRenderer in spriteRenderers)
            {
                if (spriteRenderer.sprite == null || spriteRenderer.enabled == false) continue;
                spriteStructs.Add(new SpriteStruct(spriteRenderer, localBounds, spriteRenderer.sprite, asset.transform));
            }

            return spriteStructs;
        }

        public static VisualElement SpritesToElement(this GameObject asset, SpriteStruct[] sprites, Quaternion transformRotation, float size)
        {
            VisualElement imageStack = new VisualElement();

            foreach (var spriteStruct in sprites)
            {
                var visualElement = spriteStruct.GetImage(size);
                imageStack.Add(visualElement);
            }

            imageStack.transform.rotation = transformRotation;
            if (transformRotation.eulerAngles.z != 0)
            {
                imageStack.style.position = Position.Absolute;
                imageStack.style.left = imageStack.style.right = imageStack.style.top = imageStack.style.bottom = Length.Percent(50);
                imageStack.style.marginLeft = imageStack.style.marginRight = imageStack.style.marginTop = imageStack.style.marginBottom = Length.Percent(-50);
            }

            return imageStack;
        }
    }
}
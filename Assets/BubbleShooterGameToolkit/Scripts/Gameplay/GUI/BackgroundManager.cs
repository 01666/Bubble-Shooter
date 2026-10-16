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

using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEngine;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.GUI
{
    public class BackgroundManager : MonoBehaviour
    {
        [SerializeField]
        private Image backround;

        private void Start()
        {
            if (LevelLoader.instance.CurrentLevel != null)
            {
                if (LevelLoader.instance.CurrentLevel.background != null)
                    backround.sprite = LevelLoader.instance.CurrentLevel.background;
            }
            else
            {
                LevelLoader.OnLevelLoaded += OnLevelLoaded;
            }
        }

        private void OnLevelLoaded()
        {
            if (LevelLoader.instance.CurrentLevel.background != null)
                    backround.sprite = LevelLoader.instance.CurrentLevel.background;
            LevelLoader.OnLevelLoaded -= OnLevelLoaded;
        }
    }
}
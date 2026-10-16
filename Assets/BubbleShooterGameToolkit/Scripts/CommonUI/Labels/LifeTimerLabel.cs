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

using BubbleShooterGameToolkit.Scripts.Data;
using BubbleShooterGameToolkit.Scripts.Settings;
using BubbleShooterGameToolkit.Scripts.System;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Labels
{
    public class LifeTimerLabel : Label
    {
        private Life lifeResource;
        private GameSettings gameSettings;

        private void OnEnable()
        {
            lifeResource = GameManager.instance.life;
            gameSettings = GameManager.instance.GameSettings;
            LifeRefillTimer.OnUpdateTime += UpdateLabel;
        }
        
        private void OnDisable()
        {
            LifeRefillTimer.OnUpdateTime -= UpdateLabel;
        }

        private void UpdateLabel(float time)
        {
            var hours = (int) (time / 3600);
            var minutes = (int) ((time - hours * 3600) / 60);
            var seconds = (int) (time - hours * 3600 - minutes * 60);
            label.text = lifeResource.GetResource() >= gameSettings.MaxLife ? "FULL" : $"{minutes:00}:{seconds:00}";
        }
    }
}
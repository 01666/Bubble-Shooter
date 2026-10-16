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

using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Popups
{
	public class MenuPause : Popup
	{
		public Button mapButton;
		public Button restartButton;

		private void OnEnable()
		{
			closeButton.onClick.AddListener(Play);
			mapButton.onClick.AddListener(GoToMap);
			restartButton.onClick.AddListener(Restart);
		}

		private void Restart()
		{
			GameManager.instance.RestartLevel();
			Close();
		}

		private void Play()
		{
			EventManager.SetGameStatus(EStatus.Play);
			Close();
		}

		private void GoToMap()
		{
			MenuManager.instance.ShowPopup<Confirmation>(null, ConfirmExit);
			Close();
		}

		private void ConfirmExit(EPopupResult ePopupResult)
		{
			if (result == EPopupResult.Yes)
			{
				SceneLoader.instance.GoToMap();
				Close();
			}
			else
			{
				Close();
			}
		}
	}
}

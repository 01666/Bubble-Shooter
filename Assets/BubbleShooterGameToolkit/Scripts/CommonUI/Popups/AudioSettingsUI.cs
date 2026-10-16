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

using UnityEngine;
using UnityEngine.Audio;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Popups
{
	public class AudioSettingsUI : MonoBehaviour
	{
		[SerializeField]
		private Button musicButton;
		[SerializeField]
		private Button soundButton;

		[SerializeField]
		private AudioMixer mixer;
		[SerializeField]
		private string musicParameter = "musicVolume";
		[SerializeField]
		private string soundParameter = "soundVolume";

		[SerializeField]
		private Color enabledColor;
		[SerializeField]
		private Color disabledColor;

		void Start()
		{
			musicButton.onClick.AddListener(ToggleMusic);
			soundButton.onClick.AddListener(ToggleSound);
			OnEnable();
		}

		void OnEnable()
		{
			UpdateButtonState(musicButton, "Music", musicParameter, enabledColor, disabledColor);
			UpdateButtonState(soundButton, "Sound", soundParameter, enabledColor, disabledColor);
		}

		void UpdateButtonState(Button button, string playerPrefKey, string volumeParameter, Color onColor, Color offColor)
		{
			bool enabledState = PlayerPrefs.GetInt(playerPrefKey, 1) != 0f;
			float volumeValue = enabledState ? 0 : -80;

			foreach (Image childImage in button.transform.GetChild(0).GetComponentsInChildren<Image>())
			{
				childImage.color = enabledState ? onColor : offColor;
			}

			mixer.SetFloat(volumeParameter, volumeValue);
		}

		private void ToggleMusic()
		{
			int music = PlayerPrefs.GetInt("Music", 1);
			PlayerPrefs.SetInt("Music", music == 0f ? 1 : 0);
			OnEnable();
		}

		private void ToggleSound()
		{
			int sound = PlayerPrefs.GetInt("Sound", 1);
			PlayerPrefs.SetInt("Sound", sound == 0 ? 1 : 0);
			OnEnable();
		}
	}
}
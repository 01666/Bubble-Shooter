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

using System.Collections;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using BubbleShooterGameToolkit.Scripts.Settings;
using BubbleShooterGameToolkit.Scripts.System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Popups
{
	public class MenuWin : Popup {
		[SerializeField] private GameObject[] stars;
		[SerializeField] private GameObject[] glitters;
		[SerializeField] private GameObject[] starEffets;
		[SerializeField] private Button play;
		[SerializeField] private Button restart;
		[SerializeField] private TextMeshProUGUI scoreText;	
		
		public void OnEnable () {
			play.onClick.AddListener(GoMap);
			closeButton.onClick.AddListener(GoMap);
			restart.onClick.AddListener(RestartLevel);
			for (int i = 0; i < 3; i++) {
				stars [i].SetActive (false);
			}
			scoreText.text = ScoreManager.instance.GetScore().ToString();
		}

		private void RestartLevel()
		{
			Close();
			OnCloseAction =(_) => GameManager.instance.RestartLevel();
		}

		private void GoMap()
		{
			Close();
			var gameSettings = Resources.Load<GameSettings>("Settings/GameSettings");
			if(!gameSettings.GoMapAfter.skipMap || LevelLoader.instance.CurrentLevel.Number >= gameSettings.GoMapAfter.untilLevel)
				OnCloseAction =(_) => SceneLoader.instance.GoToMap();
			else
			{
				PlayerPrefs.SetInt("OpenLevel", PlayerPrefs.GetInt("Level", 1));
				OnCloseAction = (_) => SceneLoader.instance.StartGameScene();
			}
		}

		public override void AfterShowAnimation()
		{
			base.AfterShowAnimation();
			
			AnimateStars();
		}
	
		public void AnimateStars () {
			StartCoroutine (MenuCompleteCor ());
		}

		IEnumerator MenuCompleteCor () {
			float length = 0;
			for (int i = 0; i < LevelLoader.instance.CurrentLevel.stars.Length; i++) 
			{
				var starScore = LevelLoader.instance.CurrentLevel.stars [i];
				if(starScore <= ScoreManager.instance.GetScore() && !stars[i].gameObject.activeSelf)
				{
					stars[i].SetActive(true);
					Animator animator = stars[i].GetComponent<Animator>();

					// Get the length of the current animation
					length = animator.GetCurrentAnimatorStateInfo(0).length;
					yield return new WaitForSeconds(0.3f);
				}
			}
			
			// for (int i = 0; i < starEffets.Length; i++) 
			// {
			// 	starEffets[i].SetActive(true);
			// 	yield return new WaitForSeconds(0.3f);
			// }
			
			for (int i = 0; i < glitters.Length; i++) 
			{
				glitters[i].SetActive(true);
				yield return new WaitForSeconds(0.3f);
			}
			yield return new WaitForSeconds(length);
			StartCoroutine(PlayIdleAnimation());
		}

		private IEnumerator PlayIdleAnimation()
		{
			foreach (var componentsInChild in GetComponentsInChildren<ParticleSystem>())
			{
				var inChild = componentsInChild;
				var main = inChild.main;
				if(!main.playOnAwake)
					inChild.Play();
			}
			for (int i = 0; i < stars.Length; i++)
			{
				if (stars[i].activeSelf)
				{
					stars[i].GetComponent<Animator>().Play("star-idle");
					yield return new WaitForSeconds(0.2f);
				}
			}
		}
	}
}

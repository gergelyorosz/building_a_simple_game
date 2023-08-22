using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PlayerMove : MonoBehaviour
{
    float movementSpeed = 5f;
    // Start is called before the first frame update
    void Start()
    {
        Debug.Log("Hello World");
    }

    // Update is called once per frame
    void Update()
    {
        Vector3 moveVector = Vector3.zero;

        // UP or DOWN
        if(UnityEngine.Input.GetKey(KeyCode.W)) {
            moveVector += Vector3.up;
        } else if(UnityEngine.Input.GetKey(KeyCode.S)) {
            moveVector += Vector3.down;
        }

        // LEFT of RIGHT
        if(UnityEngine.Input.GetKey(KeyCode.A)) {
            moveVector += Vector3.left;
        } else if(UnityEngine.Input.GetKey(KeyCode.D)) {
            moveVector += Vector3.right;
        };

        // CALCLULATE FINAL MOVE VECTOR AND APPLY
        Vector3 finalMoveVector = moveVector * movementSpeed * Time.deltaTime;
        this.transform.Translate(finalMoveVector);
    }
}
